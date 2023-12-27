import { NextFunction, Request, Response } from "express";
import { EnvService } from "../../services/env-service";
import { PrismaService } from "../../services/prisma-service";
import { EventTemplate, SimplePool } from "nostr-tools";
import { AzureSecretService } from "../../services/azure-secret-service";
import { KeyVaultType_SystemUser } from "../../common/key-vault";
import { NostrConnector } from "../../nostr-v4/nostrConnector";

export async function publishSystemUserController(
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

    const id = Number.parseInt(req.params.id);

    const dbSystemUser = await PrismaService.instance.db.systemUser.findUnique({
        where: { id },
        include: { systemUserRelays: true },
    });

    if (!dbSystemUser) {
        res.sendStatus(404);
        return;
    }

    const keyvaultData =
        await AzureSecretService.instance.tryGetValue<KeyVaultType_SystemUser>(
            dbSystemUser.keyvaultKey
        );
    if (!keyvaultData) {
        res.sendStatus(404);
        return;
    }

    const relayUrls = dbSystemUser.systemUserRelays.map((x) => x.url);
    const connector = new NostrConnector({
        pubkey: keyvaultData.pubkey,
        privkey: keyvaultData.privkey,
    });

    // Create Kind0 Event
    const eventTemplate: EventTemplate = {
        kind: 0,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({
            name: dbSystemUser.name,
            nip05: dbSystemUser.nip05,
            about: dbSystemUser.about,
            banner: dbSystemUser.banner,
            picture: dbSystemUser.picture,
        }),
    };

    console.log(eventTemplate);

    const kind0Event = connector.signEvent(eventTemplate);

    const pool = new SimplePool();
    const pubs = pool.publish(relayUrls, kind0Event);
    await Promise.all(pubs);
    res.json("OK");
}

