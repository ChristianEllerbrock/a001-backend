import { NextFunction, Request, Response } from "express";
import { PrismaService } from "../../services/prisma-service";
import { systemDomainIds } from "../../common/enums/system-domain";
import { AzureSecretService } from "../../services/azure-secret-service";
import { EventTemplate, generatePrivateKey, getPublicKey } from "nostr-tools";
import {
    EmailKeyvaultType,
    emailKeyvaultTypeKeyPrefix,
} from "../../common/keyvault-types/email-keyvault-type";
import { NostrConnector } from "../../nostr-v4/nostrConnector";
import { v4 } from "uuid";
import { Nip65RelayList, RelayEvent } from "../../nostr-v4/type-defs";
import { NostrRelayerService } from "../../services/nostr-relayer.service";
import { SendGridEmailEnvelope } from "./type-defs";
import { DateTime } from "luxon";

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

    if (!body.from || !body.envelope || !body.text) {
        console.log(`EMAIL: Trigger without TEXT, FROM or TO (via ENVELOPE)`);
        return;
    }

    const envelope: SendGridEmailEnvelope = JSON.parse(body.envelope);
    const to = envelope.to[0];

    console.log(`EMAIL: ${to} < ${body.from}`);

    // 1. Check if the intended TO domain exists in the database.
    const receiverDomainId = systemDomainIds.get(
        to.split("@")[1].toLowerCase()
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
                identifier: to.split("@")[0].toLowerCase(),
            },
            include: {
                user: true,
                registrationRelays: true,
            },
        });
    if (!dbRegistration) {
        console.log(
            `${to} - No registration found in the database for the receiver.`
        );
        return;
    }

    // 3. Check if email forwarding is activated for the registration.
    if (!dbRegistration.emailForwardingOn) {
        console.log(
            `${to} - Email forwarding is NOT activated for the registration.`
        );
        return;
    }

    // 4. Check if the account has configured at least one relay.
    if (dbRegistration.registrationRelays.length === 0) {
        console.log(`${to} - The receiver has NOT configured any relays.`);
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

    const dbEmail = await assureEmailExists(fromEmail, to);

    // Get the privkey/pubkey info from the Azure keyvault.
    const emailKeyvault =
        await AzureSecretService.instance.tryGetValue<EmailKeyvaultType>(
            dbEmail.keyvaultKey
        );
    if (!emailKeyvault) {
        throw new Error(
            `${to} - Could not retrieve email object from Azure keyvault.`
        );
    }

    const destinationRelays = dbRegistration.registrationRelays.map(
        (x) => x.address
    );

    const relayList =
        await NostrRelayerService.instance.fetchRelayListForPubkey(
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
            `${to} - Publish metadata to the relays: ${missingRelaysForMetadata.join(
                ", "
            )}`
        );
        //console.log(kind0Event);

        // Publish event.
        const publishedRelayEvents =
            await NostrRelayerService.instance.relayer.publishEventAsync(
                kind0Event,
                missingRelaysForMetadata
            );

        const publishedRelays = Array.from(
            new Set<string>(publishedRelayEvents.map((x) => x.url))
        );
        console.log(
            `${to} - Successfully published metadata to the relays ${publishedRelays.join(
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
    if (body.cc) {
        message += `CC: ${body.cc}\n`;
    }
    if ((body.attachments as number) > 0) {
        message += `ATTACHMENTS: ${body.attachments}\n`;
    }
    message += "---\n\n" + body.text;

    const kind4Event = await connector.generateDM(
        message,
        dbRegistration.user.pubkey
    );
    console.log(
        `${to} - Sending DM event to the relays ${targetRelays.join(", ")}`
    );

    await NostrRelayerService.instance.relayer.publishEventAsync(
        kind4Event,
        targetRelays
    );

    // Update Stats
    const today = DateTime.now().startOf("day");
    await PrismaService.instance.db.registrationEmailIn.upsert({
        where: {
            registrationId_date: {
                registrationId: dbRegistration.id,
                date: today.toJSDate(),
            },
        },
        update: {
            total: { increment: 1 },
        },
        create: {
            registrationId: dbRegistration.id,
            date: today.toJSDate(),
            total: 1,
        },
    });
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
    const about =
        `I was created to mirror the email ${fromEmail} and handle email forwarding on https://nip05.social\n\n` +
        `Send me a DM with the text "help", and I will answer with instructions about what I can do.`;

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
                    about,
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

