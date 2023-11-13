import { NextFunction, Request, Response } from "express";
import { PrismaService } from "../../services/prisma-service";
import { AzureSecretService } from "../../services/azure-secret-service";
import { EmailKeyvaultType } from "../../common/keyvault-types/email-keyvault-type";
import { NostrConnector } from "../../nostr-v4/nostrConnector";
import { NostrRelayerService } from "../../services/nostr-relayer.service";
import { EventTemplate } from "nostr-tools";
import { EnvService } from "../../services/env-service";
import { STATUS_CODES } from "http";

const _log = function (text: string) {
    console.log("ADMIN - Update Email About - " + text);
};

export async function adminUpdateEmailAboutController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const apiKey = req.headers["X-Auth-Token"];
    if (
        typeof apiKey === "undefined" ||
        apiKey !== EnvService.instance.env.API_ADMIN_KEY
    ) {
        res.sendStatus(401);
        return;
    }

    const dbEmails = await PrismaService.instance.db.email.findMany({
        include: {
            emailNostr: { include: { emailNostrProfiles: true } },
        },
    });

    for (const dbEmail of dbEmails) {
        _log(`Trying to update '${dbEmail.address}'`);
        const about =
            `I was created to mirror the email ${dbEmail.address} and handle email forwarding on https://nip05.social\n\n` +
            `Send me a DM with the text "help", and I will answer with instructions about what I can do.`;

        const keyvaultData =
            await AzureSecretService.instance.tryGetValue<EmailKeyvaultType>(
                dbEmail.keyvaultKey
            );
        if (!keyvaultData) {
            _log("Error: Could not get Azure keyvault data.");
            continue;
        }

        const connector = new NostrConnector({
            pubkey: keyvaultData.pubkey,
            privkey: keyvaultData.privkey,
        });

        const eventTemplate: EventTemplate = {
            kind: 0,
            created_at: Math.floor(Date.now() / 1000),
            content: JSON.stringify({
                name: dbEmail.emailNostr?.name,
                nip05: dbEmail.emailNostr?.nip05,
                about,
                banner: dbEmail.emailNostr?.banner,
                picture: dbEmail.emailNostr?.picture,
            }),
            tags: [],
        };

        const kind0Event = connector.signEvent(eventTemplate);

        const result =
            await NostrRelayerService.instance.relayer.publishEventAsync(
                kind0Event,
                dbEmail.emailNostr?.emailNostrProfiles.map(
                    (x) => x.publishedRelay
                ) ?? []
            );

        _log(`Done on ${result.length} relays`);
    }

    res.json("OK");
}

