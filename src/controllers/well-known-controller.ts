import { NextFunction, Request, Response } from "express";
import { buildNip05FromDatabaseAsync } from "../nostr/helpers";
import { PrismaService } from "../services/prisma-service";
import { Nip05CacheService } from "../services/nip05-cache-service";

interface Query {
    name?: string;
}

export async function wellKnownController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const query = req.query as Query;
        if (typeof query.name === "undefined") {
            throw new Error(
                "Please provide a name parameter with the identifier you want to query."
            );
        }

        const identifier = query.name.trim();

        // 1st check the cache
        let cacheStore = Nip05CacheService.instance.get(identifier);
        if (!cacheStore) {
            const data = await buildNip05FromDatabaseAsync(identifier);

            // cache element
            cacheStore = Nip05CacheService.instance.set(
                identifier,
                data[0], // registration.id
                data[1]
            );
        }

        // update stats
        await PrismaService.instance.db.registration.update({
            where: { id: cacheStore.registrationId },
            data: {
                nipped: { increment: 1 },
            },
        });

        res.json(cacheStore.nip05);
    } catch (error) {
        next(error);
    }
}

