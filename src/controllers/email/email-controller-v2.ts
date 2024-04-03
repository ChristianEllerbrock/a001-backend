import { NextFunction, Request, Response } from "express";
import { PrismaService } from "../../services/prisma-service";
import { systemDomainIds } from "../../common/enums/system-domain";
import { AzureSecretService } from "../../services/azure-secret-service";
import { EventTemplate, generateSecretKey, getPublicKey } from "nostr-tools";
import {
    KeyVaultType_Email,
    emailKeyvaultTypeKeyPrefix,
} from "../../common/key-vault";
import { NostrConnector } from "../../nostr-v4/nostrConnector";
import { v4 } from "uuid";
import { DateTime } from "luxon";
import { Nip05NostrService } from "../../services/nip05-nostr/nip05-nostr-service";
import { log } from "./common";
import { checkEmailInSubscriptionAndRespondIfNecessary } from "./subscription-related";
import { Nip05SocialRelayAllowedService } from "../../relay/nip05-social-relay-allowed-service";
import { NostrHelperV2 } from "../../nostr/nostr-helper-2";
import { EnvService } from "../../services/env-service";
import {
    WebhookEmailIn,
    WebhookEmailInData,
    WebhookEmailInProcessedRegistrationDetails,
} from "./webhook-email-in";

export async function emailControllerV2(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const apiKey = req.headers["x-auth-token"];
    if (
        typeof apiKey === "undefined" ||
        apiKey !== EnvService.instance.env.API_ADMIN_KEY
    ) {
        res.sendStatus(401);
        return;
    }
    log("Webhook triggered");

    handleEmail(req);
    res.json({ received: true });
}

const handleEmail = async function (req: Request) {
    log(JSON.stringify(req.body));
    const webhookEmailIn = new WebhookEmailIn(req.body);
    log(JSON.stringify(webhookEmailIn.data));

    if (!webhookEmailIn.isValid()) {
        log(`Invalid email data`);
        return;
    }

    // 1. Determine the TO systemDomainIds
    webhookEmailIn.data.to.forEach((x) => {
        const nip05DomainId = systemDomainIds.get(webhookEmailIn.getDomain(x));
        webhookEmailIn.processed.to.push([x, nip05DomainId, undefined]);
    });

    if (webhookEmailIn.processed.to.every((x) => typeof x[1] === "undefined")) {
        log(`No domain found in the database that matches the TO domain(s).`);
        return;
    }

    // 2. Determine the registration details of the receiver(s).
    for (const processedTo of webhookEmailIn.processed.to) {
        if (processedTo[1] === undefined) {
            continue;
        }

        const dbRegistration =
            await PrismaService.instance.db.registration.findFirst({
                where: {
                    systemDomainId: processedTo[1],
                    identifier: processedTo[0].split("@")[0],
                },
                include: {
                    user: {
                        include: { subscription: true },
                    },
                    registrationRelays: true,
                    registrationEmailIns: true,
                },
            });
        if (!dbRegistration) {
            continue;
        }

        const registrationDetails: WebhookEmailInProcessedRegistrationDetails =
            {
                registrationId: dbRegistration.id,
                subscriptionMaxNoOfInboundEmailsPer30Days:
                    dbRegistration.user.subscription
                        .maxNoOfInboundEmailsPer30Days,
                emailForwardingOn: dbRegistration.emailForwardingOn ?? false,
                userPubkey: dbRegistration.user.pubkey,
                registrationEmailIns: dbRegistration.registrationEmailIns,
            };
        processedTo[2] = registrationDetails;
    }

    if (webhookEmailIn.processed.to.every((x) => typeof x[2] === "undefined")) {
        log(
            `No registrations found in the database that match the TO domain(s).`
        );
        return;
    }

    for (const processedTo of webhookEmailIn.processed.to) {
        if (typeof processedTo[1] === "undefined") {
            continue;
        }

        if (typeof processedTo[2] === "undefined") {
            log(
                `No registration found in the database that matches ${processedTo[0]}. Skip.`
            );
            continue;
        }

        await processTo(processedTo, webhookEmailIn.data);
    }
};

const processTo = async function (
    processedTo: [
        address: string,
        nip05DomainId: number | undefined,
        registrationDetails:
            | WebhookEmailInProcessedRegistrationDetails
            | undefined
    ],
    data: WebhookEmailInData
) {
    if (
        typeof processedTo[1] === "undefined" ||
        typeof processedTo[2] === "undefined"
    ) {
        return;
    }

    const from = data.from[0];

    // Check, if email forwarding is activated for the registration.
    if (!processedTo[2].emailForwardingOn) {
        log(
            `${processedTo[0]} - Email forwarding is NOT activated for this registration. Skip.`
        );
        return;
    }

    const dbEmailFrom = await assureFromEmailExists(from);

    // Get the privkey/pubkey info from the Azure keyvault.
    const emailKeyvault =
        await AzureSecretService.instance.tryGetValue<KeyVaultType_Email>(
            dbEmailFrom.keyvaultKey
        );
    if (!emailKeyvault) {
        throw new Error(
            `${processedTo[0]} - Could not retrieve the email object from Azure keyvault for FROM ${from}.`
        );
    }

    const connector = new NostrConnector({
        pubkey: emailKeyvault.pubkey,
        privkey: emailKeyvault.privkey,
    });

    // Check if the subscription covers EMAIL IN
    const ok = await checkEmailInSubscriptionAndRespondIfNecessary(
        processedTo[2].subscriptionMaxNoOfInboundEmailsPer30Days,
        processedTo[2].registrationEmailIns,
        connector,
        processedTo[2].userPubkey
    );

    if (!ok) {
        return;
    }

    // // The user has an appropriate subscription. Deliver email as DM.

    // The targetRelays define the relays where the email should be published to.
    const targetRelays =
        await Nip05NostrService.instance.getRelevantAccountRelays(
            processedTo[2].userPubkey
        );

    // Check, if the created nostr email account (for the FROM) already has published
    // his metadata profile to these relays.
    const missingRelaysForMetadata: string[] = [];
    for (const targetRelay of targetRelays) {
        if (
            !dbEmailFrom.emailNostr?.emailNostrProfiles
                .map((x) => x.publishedRelay)
                .includes(targetRelay)
        ) {
            missingRelaysForMetadata.push(targetRelay);
        }
    }

    if (missingRelaysForMetadata.length > 0) {
        // Publish the profile to these relays.
        // Create Kind0 metadata event.
        const eventTemplate: EventTemplate = {
            kind: 0,
            created_at: Math.floor(new Date().getTime() / 1000),
            content: JSON.stringify({
                name: dbEmailFrom.emailNostr?.name,
                nip05: dbEmailFrom.emailNostr?.nip05,
                about: dbEmailFrom.emailNostr?.about,
                banner: dbEmailFrom.emailNostr?.banner,
                picture: dbEmailFrom.emailNostr?.picture,
            }),
            tags: [],
        };
        const kind0Event = connector.signEvent(eventTemplate);

        log(
            `${
                processedTo[0]
            } - Publish metadata for FROM nostr account ${from} to the relays: ${missingRelaysForMetadata.join(
                ", "
            )}`
        );

        // Publish event.
        const publishedRelays = await Nip05NostrService.instance.publishEvent(
            kind0Event,
            missingRelaysForMetadata
        );

        log(
            `${
                processedTo[0]
            } - Successfully published metadata for FROM nostr account ${from} to the relays ${publishedRelays.join(
                ", "
            )}`
        );

        const now = new Date();
        if (dbEmailFrom.emailNostr) {
            for (const relay of publishedRelays) {
                await PrismaService.instance.db.emailNostrProfile.create({
                    data: {
                        emailNostrId: dbEmailFrom.emailNostr.id,
                        publishedAt: now,
                        publishedRelay: relay,
                    },
                });
            }
        }
    }

    // Finally, generate the DM and publish to all targetRelays.
    let message = "";
    if (data.subject) {
        message += `SUBJECT: ${data.subject}\n`;
    }
    message += `FROM: ${from}\n`;
    // if (body.cc) {
    //     message += `CC: ${body.cc}\n`;
    // }
    if (data.noOfAttachments > 0) {
        message += `ATTACHMENTS: ${data.noOfAttachments}\n`;
    }
    message += "---\n\n" + data.text;

    log(
        `${processedTo[0]} - Sending DM event to the relays ${targetRelays.join(
            ", "
        )}`
    );
    await Nip05NostrService.instance.sendDM(
        connector,
        processedTo[2].userPubkey,
        targetRelays,
        message
    );

    // Update Stats
    const today = DateTime.now().startOf("day");
    await PrismaService.instance.db.registrationEmailIn.upsert({
        where: {
            registrationId_date: {
                registrationId: processedTo[2].registrationId,
                date: today.toJSDate(),
            },
        },
        update: {
            total: { increment: 1 },
        },
        create: {
            registrationId: processedTo[2].registrationId,
            date: today.toJSDate(),
            total: 1,
        },
    });
};

const assureFromEmailExists = async function (fromEmail: string) {
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
    const secretKey = generateSecretKey();
    const privkey = NostrHelperV2.uint8ArrayToHex(secretKey);
    const pubkey = getPublicKey(secretKey);

    // Store pubkey/privkey for the email in the Azure vault.
    const keyvaultSecretName = `${emailKeyvaultTypeKeyPrefix}${fromEmail.replace(
        /@|\./g,
        "--"
    )}`;
    const emailKeyvault: KeyVaultType_Email = {
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
        `Send me a DM with the text "help", and I will answer with instructions about what I can do. ` +
        `Please note that I will answer to registered users only.`;

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

    Nip05SocialRelayAllowedService.instance.addSystemPubkeys(
        [pubkey],
        "email-mirror"
    );

    return dbEmail;
};

