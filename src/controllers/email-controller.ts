import { NextFunction, Request, Response } from "express";
import { PrismaService } from "../services/prisma-service";
import { systemDomainIds } from "../common/enums/system-domain";
import { Email, EmailNostr } from "@prisma/client";
import { AzureSecretService } from "../services/azure-secret-service";
import {
    Event,
    EventTemplate,
    generatePrivateKey,
    getEventHash,
    getPublicKey,
    getSignature,
    signEvent,
} from "nostr-tools";
import {
    EmailKeyvaultType,
    emailKeyvaultTypeKeyPrefix,
} from "../common/keyvault-types/email-keyvault-type";
import { NostrRelayer } from "../nostr-v4/nostrRelayer";
import { NostrConnector } from "../nostr-v4/nostrConnector";
import { NostrPubSub } from "../nostr-v4/nostrPubSub";
import { v4 } from "uuid";
import { Nip65RelayList, RelayEvent } from "../nostr-v4/type-defs";
import { NostrRelayerService } from "../services/nostr-relayer.service";

export async function emailController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    handleEmail(req);
    res.json({ received: true });
}

const handleEmail = async function (req: Request) {
    const body = req.body;

    if (!body.from || !body.to || !body.text) {
        console.log(`EMAIL: Trigger without TEXT, FROM or TO`);
        return;
    }

    console.log(`EMAIL: ${body.to} < ${body.from}`);
    console.log(body);

    // 1. Check if the intended TO domain exists in the database.
    const receiverDomainId = systemDomainIds.get(
        body.to.split("@")[1].toLowerCase()
    );
    if (!receiverDomainId) {
        // This will most likely not happen since sendgrid will be configured to
        // only forward requests for the system domains.
        return;
    }

    // 2. Check if the intended TO (identifier + domain) exists in the database.
    const dbRegistration =
        await PrismaService.instance.db.registration.findFirst({
            where: {
                systemDomainId: receiverDomainId,
                identifier: body.to.split("@")[0].toLowerCase(),
            },
            include: {
                user: true,
                registrationRelays: true,
            },
        });
    if (!dbRegistration) {
        console.log(
            `${body.to} - No registration found in the database for the receiver.`
        );
        return;
    }

    // 3. Check if email forwarding is activated for the registration.
    if (!dbRegistration.emailForwardingOn) {
        console.log(
            `${body.to} - Email forwarding is NOT activated for the registration.`
        );
        return;
    }

    // 4. Check if the account has configured at least one relay.
    if (dbRegistration.registrationRelays.length === 0) {
        console.log(`${body.to} - The receiver has NOT configured any relays.`);
        return;
    }

    // The receiver (aka the registration) exists in the database
    // and has at least one relay configured.
    // We will try to deliver the email as Nostr DM.

    const fromEmailString = body.from.toLowerCase();
    let fromEmail = fromEmailString;
    // fromEmailString could look like "Peter Lustig <peter.lustig@gmail.com>"
    if (fromEmailString.includes("<")) {
        fromEmail = fromEmailString.split("<")[1].replace(">", "");
    }

    const dbEmail = await assureEmailExists(fromEmail, body.to);

    // Get the privkey/pubkey info from the Azure keyvault.
    const emailKeyvault =
        await AzureSecretService.instance.tryGetValue<EmailKeyvaultType>(
            dbEmail.keyvaultKey
        );
    if (!emailKeyvault) {
        throw new Error(
            `${body.to} - Could not retrieve email object from Azure keyvault.`
        );
    }

    const destinationRelays = dbRegistration.registrationRelays.map(
        (x) => x.address
    );

    const relayList = await fetchRelayListForPubkey(
        dbRegistration.user.pubkey,
        destinationRelays
    );

    const targetRelays = Array.from(
        new Set<string>([
            ...destinationRelays,
            ...relayList
                .filter(
                    (x) =>
                        x.operation === "read" || x.operation === "read+write"
                )
                .map((x) => x.url.toLowerCase()),
        ])
    );

    // The targetRelays define the relays where the email should be published to.

    // Check, if the created nostr email account (for the FROM) already has published
    // his metadata profile to these relays.
    const missingRelaysForMetadata: string[] = [];
    for (const targetRelay of targetRelays) {
        if (
            !dbEmail.emailNostr?.emailNostrProfiles
                .map((x) => x.publishedRelay)
                .includes(targetRelay)
        ) {
            missingRelaysForMetadata.push(targetRelay);
        }
    }

    const connector = new NostrConnector({
        pubkey: emailKeyvault.pubkey,
        privkey: emailKeyvault.privkey,
    });

    if (missingRelaysForMetadata.length > 0) {
        // Publish the profile to these relays.
        // Create Kind0 metadata event.
        const eventTemplate: EventTemplate = {
            kind: 0,
            created_at: Math.floor(new Date().getTime() / 1000),
            content: JSON.stringify({
                name: dbEmail.emailNostr?.name,
                nip05: dbEmail.emailNostr?.nip05,
                about: dbEmail.emailNostr?.about,
                banner: dbEmail.emailNostr?.banner,
                picture: dbEmail.emailNostr?.picture,
            }),
            tags: [],
        };
        const kind0Event = connector.signEvent(eventTemplate);

        console.log(
            `${
                body.to
            } - Publish metadata to the relays: ${missingRelaysForMetadata.join(
                ", "
            )}`
        );
        //console.log(kind0Event);

        // Publish event.
        const publishedRelayEvents =
            await NostrRelayerService.instance.publishEventAsync(
                kind0Event,
                missingRelaysForMetadata
            );

        const publishedRelays = Array.from(
            new Set<string>(publishedRelayEvents.map((x) => x.url))
        );
        console.log(
            `${
                body.to
            } - Successfully published metadata to the relays ${publishedRelays.join(
                ", "
            )}`
        );

        const now = new Date();
        if (dbEmail.emailNostr) {
            for (const relay of publishedRelays) {
                await PrismaService.instance.db.emailNostrProfile.create({
                    data: {
                        emailNostrId: dbEmail.emailNostr.id,
                        publishedAt: now,
                        publishedRelay: relay,
                    },
                });
            }
        }
    }

    // Finally, generate the DM and publish to all targetRelays.
    let message = `SUBJECT: ${body.subject}\n` + `FROM: ${dbEmail.address}\n`;
    if ((body.attachments as number) > 0) {
        message += `ATTACHMENTS: ${body.attachments}\n`;
    }
    message += "---\n\n" + body.text;

    const kind4Event = await connector.generateDM(
        message,
        dbRegistration.user.pubkey
    );
    console.log(
        `${body.to} - Sending DM event to the relays ${targetRelays.join(", ")}`
    );

    await NostrRelayerService.instance.publishEventAsync(
        kind4Event,
        targetRelays
    );
};

const fetchRelayListForPubkey = function (
    pubkey: string,
    fromRelays: string[]
): Promise<Nip65RelayList[]> {
    return new Promise((resolve, reject) => {
        const channelId = v4();
        let receivedRelayEvents: RelayEvent[] = [];
        NostrRelayerService.instance.nostrPubSub.on(
            channelId,
            (eos: boolean, relayEvents: RelayEvent[]) => {
                receivedRelayEvents.push(...relayEvents);

                if (!eos) {
                    return;
                }

                // End Of Stream
                const relayListRelayEvent =
                    filterRelayListRelayEvents(receivedRelayEvents);
                if (!relayListRelayEvent) {
                    resolve([]);
                }

                const nip65RelayList: Nip65RelayList[] = [];
                for (let tag of relayListRelayEvent?.event.tags ?? []) {
                    if (tag[0] !== "r") {
                        continue;
                    }

                    const url = tag[1];
                    const operation = tag[2] as string | undefined;

                    if (typeof operation === "undefined") {
                        nip65RelayList.push({
                            url,
                            operation: "read+write",
                        });
                    } else if (operation === "read" || operation === "write") {
                        nip65RelayList.push({
                            url,
                            operation,
                        });
                    }
                }

                resolve(nip65RelayList);
            }
        );

        NostrRelayerService.instance.fetchReplaceableEvents(
            channelId,
            pubkey,
            [10002],
            fromRelays
        );
    });
};

const filterRelayListRelayEvents = function (
    relayEvents: RelayEvent[]
): RelayEvent | undefined {
    const filteredRelayEvents: RelayEvent[] = [];

    const latestRegularRelayEvent = Array.from(relayEvents)
        .filter((x) => x.event.kind !== 5)
        .sortBy((x) => x.event.created_at, "desc")
        .shift();

    if (typeof latestRegularRelayEvent === "undefined") {
        return undefined;
    }

    const latestDeletionRelayEvent = Array.from(relayEvents)
        .filter((x) => x.event.kind === 5)
        .sortBy((x) => x.event.created_at, "desc")
        .shift();

    if (typeof latestDeletionRelayEvent === "undefined") {
        return latestRegularRelayEvent;
    }

    return latestDeletionRelayEvent.event.created_at >
        latestRegularRelayEvent.event.created_at
        ? undefined
        : latestRegularRelayEvent;
};

const assureEmailExists = async function (fromEmail: string, to: string) {
    let dbEmail = await PrismaService.instance.db.email.findFirst({
        where: {
            address: fromEmail,
        },
        include: {
            emailNostr: {
                include: {
                    emailNostrProfiles: true,
                },
            },
        },
    });
    if (dbEmail) {
        return dbEmail;
    }

    // No match found in the database. Create an entry.

    // First generate a new (unique) nip05.
    let nip05: string | undefined;
    let attempt = 0;
    do {
        const nip05Try =
            "email_" + v4().replace("-", "").slice(0, 12) + "@nip05.social";

        const db = await PrismaService.instance.db.emailNostr.findFirst({
            where: {
                nip05: nip05Try,
            },
        });
        if (!db) {
            nip05 = nip05Try;
            break;
        }

        attempt++;
    } while (attempt <= 10);

    if (!nip05) {
        throw new Error(
            "Could not generate a unique NIP-05 for the new mirror."
        );
    }

    // Now, create a new pubkey/privkey pair.
    const privkey = generatePrivateKey();
    const pubkey = getPublicKey(privkey);

    // Store pubkey/privkey for the email in the Azure vault.
    const keyvaultSecretName = `${emailKeyvaultTypeKeyPrefix}${fromEmail.replace(
        /@|\./g,
        "--"
    )}`;
    const emailKeyvault: EmailKeyvaultType = {
        email: fromEmail,
        pubkey,
        privkey,
    };
    const ok = await AzureSecretService.instance.trySetValue(
        keyvaultSecretName,
        emailKeyvault
    );
    if (!ok) {
        throw new Error("Could not set email keyvault data in Azure Keyvault.");
    }

    // Create database record(s).
    dbEmail = await PrismaService.instance.db.email.create({
        data: {
            address: fromEmail,
            createdAt: new Date(),
            keyvaultKey: keyvaultSecretName,
            emailNostr: {
                create: {
                    pubkey,
                    nip05,
                    name: fromEmail,
                    about: `I mirror the email '${fromEmail}'. I was created to handle email forwarding on https://nip05.social.`,
                    picture:
                        "https://nip05assets.blob.core.windows.net/public/robot-head-01.jpg",
                    banner: "https://nip05assets.blob.core.windows.net/public/profile-background-3.jpg",
                    lookups: 0,
                },
            },
        },
        include: {
            emailNostr: {
                include: {
                    emailNostrProfiles: true,
                },
            },
        },
    });

    return dbEmail;
};

// console.log("dkim: ", body.dkim);
// console.log("to: ", body.to);
// console.log("cc: ", body.cc);
// console.log("from: ", body.from);
// console.log("subject: ", body.subject);
// console.log("sender_ip: ", body.sender_ip);
// console.log("spam_report: ", body.spam_report);
// console.log("envelope: ", body.envelope);
// console.log("charsets: ", body.charsets);
// console.log("SPF: ", body.SPF);
// console.log("spam_score: ", body.spam_score);

// // Logs properties
// if (rawFullMimeMessageChecked) {
//     console.log("email: ", body.email);
// } else {
//     //console.log("headers: ", body.headers);
//     console.log("html: ", body.html);
//     console.log("text: ", body.text);
//     console.log("attachments: ", body.attachments);
//     console.log("attachment-info: ", body["attachment-info"]);
//     console.log("content-ids: ", body["content-ids"]);
// }

// if (req.files?.length ?? 0 > 0) {
//     // Log file data
//     console.log(req.files);
// } else {
//     console.log("No files...");
// }

