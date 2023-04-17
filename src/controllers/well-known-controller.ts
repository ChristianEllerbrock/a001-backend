import { NextFunction, Request, Response } from "express";
import { buildNip05FromDatabaseAsync } from "../nostr/helpers";
import { PrismaService } from "../services/prisma-service";
import { Nip05CacheService } from "../services/nip05-cache-service";
import { DateTime } from "luxon";

interface Query {
    name?: string;
}

export async function wellKnownController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const today = DateTime.now().startOf("day");

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

        // update specific (for this registration) stats
        await PrismaService.instance.db.registration.update({
            where: { id: cacheStore.registrationId },
            data: {
                nipped: { increment: 1 },
            },
        });

        // update global stats
        const dbDailyLookup =
            await PrismaService.instance.db.dailyLookup.findFirst({
                where: { date: today.toJSDate() },
            });
        if (dbDailyLookup) {
            await PrismaService.instance.db.dailyLookup.update({
                where: { id: dbDailyLookup.id },
                data: { nipped: dbDailyLookup.nipped + 1 },
            });
        } else {
            await PrismaService.instance.db.dailyLookup.create({
                data: {
                    date: today.toJSDate(),
                    nipped: 1,
                },
            });
        }

        res.json(cacheStore.nip05);
    } catch (error) {
        next(error);
    }
}
