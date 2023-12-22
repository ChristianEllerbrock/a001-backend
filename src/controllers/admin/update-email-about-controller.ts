import { NextFunction, Request, Response } from "express";
import { PrismaService } from "../../services/prisma-service";
import { AzureSecretService } from "../../services/azure-secret-service";
import { KeyVaultType_Email } from "../../common/key-vault";
import { NostrConnector } from "../../nostr-v4/nostrConnector";
import { EventTemplate } from "nostr-tools";
import { EnvService } from "../../services/env-service";
import { Nip05NostrService } from "../../services/nip05-nostr/nip05-nostr-service";
import { sleep } from "../../helpers/sleep";

const _log = function (text: string) {
    console.log("ADMIN - Update Email About - " + text);
};

export async function adminUpdateEmailAboutController(
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

    const email = req.params.email;

    const dbEmail = await PrismaService.instance.db.email.findFirst({
        where: {
            address: email.toLowerCase(),
        },
        include: {
            emailNostr: {
                include: { emailNostrProfiles: true },
            },
        },
    });

    if (!dbEmail) {
        res.json("Database record not found.");
        return;
    }

    for (const dbItem of [dbEmail]) {
        _log(`Trying to update '${dbItem.address}'`);
        const about =
            `I was created to mirror the email ${dbItem.address} and handle email forwarding on https://nip05.social\n\n` +
            `Send me a DM with the text "help", and I will answer with instructions about what I can do. ` +
            `Please note that I will answer to registered users only.`;

        const keyvaultData =
            await AzureSecretService.instance.tryGetValue<KeyVaultType_Email>(
                dbItem.keyvaultKey
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
                name: dbItem.emailNostr?.name,
                nip05: dbItem.emailNostr?.nip05,
                about,
                banner: dbItem.emailNostr?.banner,
                picture: dbItem.emailNostr?.picture,
            }),
            tags: [],
        };

        const kind0Event = connector.signEvent(eventTemplate);

        const result = await Nip05NostrService.instance.publishEvent(
            kind0Event,
            dbItem.emailNostr?.emailNostrProfiles.map(
                (x) => x.publishedRelay
            ) ?? []
        );

        _log(`Done on ${result.length} relays`);
        sleep(1000);
    }

    res.json("OK");
}

