import { NextFunction, Request, Response } from "express";
import { PrismaService } from "../services/prisma-service";
import { DateTime } from "luxon";
import { SystemUserCacheService } from "../services/system-user-cache-service";
import { Nip05 } from "../nostr/type-defs";
import { RMService } from "../services/redis-memory-service";
import { RedisTypeLookupData } from "../types/redis/@types";

interface Query {
    name?: string;
}

const bumpGlobalStats = async function () {
    const now = DateTime.now();
    const today = now.startOf("day");

    const erGlobalLookupStats = await RMService.i.globalLookupStats.fetch();
    if (!erGlobalLookupStats) {
        // This should only happen once.
        await RMService.i.globalLookupStats.save({
            lastLookupAt: new Date().toISOString(),
            lookups: 1,
            dailyLookups: [
                {
                    date: today.toJSDate().toISOString(),
                    lookups: 1,
                },
            ],
        });
        return;
    }

    // Update stats in Redis.
    erGlobalLookupStats.data.lookups++;
    erGlobalLookupStats.data.lastLookupAt = now.toJSDate().toISOString();
    const dailyLookup = erGlobalLookupStats.data.dailyLookups.find(
        (x) => x.date === today.toJSDate().toISOString()
    );
    if (dailyLookup) {
        dailyLookup.lookups++;
    } else {
        erGlobalLookupStats.data.dailyLookups.push({
            date: today.toJSDate().toISOString(),
            lookups: 1,
        });
    }

    await erGlobalLookupStats.save();
};

export async function wellKnownNostrController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const today = DateTime.now().startOf("day");
        const now = DateTime.now();

        const query = req.query as Query;
        if (typeof query.name === "undefined") {
            throw new Error(
                "Please provide a name parameter with the identifier you want to query."
            );
        }

        const identifier = query.name.trim().toLowerCase();

        // Determine the domain from the request.
        let domain = "";
        if (req.hostname.includes("localhost")) {
            domain = "nip05.social";
        } else {
            const hostnameParts = req.hostname.toLowerCase().split(".");
            const lastIndex = hostnameParts.length - 1;
            domain = (
                hostnameParts[lastIndex - 1] +
                "." +
                hostnameParts[lastIndex]
            ).toLowerCase();
        }

        console.log(`CHECK '${identifier}@${domain}'`);

        const fullIdentifier = `${identifier}@${domain}`.toLowerCase();

        // Just make sure that all system users are available.
        await SystemUserCacheService.instance.initialize();

        // Check RedisMemory first.
        const erLookupData = await RMService.i.lookupData.fetch(fullIdentifier);

        if (erLookupData) {
            // This could still be an "empty" record, that was created
            // to avoid future database queries.
            // In that case just return an empty response.
            if (Object.keys(erLookupData.data.names).length === 0) {
                res.json({
                    names: {},
                });
                return;
            }

            // This is a valid record in RedisMemory. Continue.
            let erLookupStats = await RMService.i.lookupStats.fetch(
                fullIdentifier
            );

            // Update user stats.
            if (!erLookupStats) {
                // No stats available. First time query.

                erLookupStats = await RMService.i.lookupStats.save(
                    fullIdentifier,
                    {
                        nip05: fullIdentifier,
                        lastLookupAt: now.toJSDate().toISOString(),
                        lookups: 1,
                        dailyLookups: [
                            {
                                date: today.toJSDate().toISOString(),
                                lookups: 1,
                            },
                        ],
                    }
                );
            } else {
                // Update stats in Redis.
                erLookupStats.data.lookups++;
                erLookupStats.data.lastLookupAt = now.toJSDate().toISOString();
                const dailyLookup = erLookupStats.data.dailyLookups.find(
                    (x) => x.date === today.toJSDate().toISOString()
                );
                if (dailyLookup) {
                    dailyLookup.lookups++;
                } else {
                    erLookupStats.data.dailyLookups.push({
                        date: today.toJSDate().toISOString(),
                        lookups: 1,
                    });
                }

                await erLookupStats.save();
            }

            // Update global stats.
            await bumpGlobalStats();

            const nip05Response: Nip05 = {
                names: erLookupData.data.names,
            };
            if (
                typeof erLookupData.data.relays !== "undefined" &&
                Object.keys(erLookupData.data.relays).length > 0
            ) {
                nip05Response.relays = erLookupData.data.relays;
            }

            res.json(nip05Response);
            return;
        }

        // The data is not (yet) in RedisMemory. Check the database.

        // 1. Check: The request is for a system user
        const dbSystemUser = SystemUserCacheService.instance.systemUsers?.find(
            (x) => x.nip05 === fullIdentifier
        );
        if (dbSystemUser) {
            // Write to Redis to avoid SQL queries in the future.
            await RMService.i.lookupStats.save(fullIdentifier, {
                nip05: fullIdentifier,
                lastLookupAt: new Date().toISOString(),
                lookups: dbSystemUser.lookups + 1,
                dailyLookups: [
                    {
                        date: today.toJSDate().toISOString(),
                        lookups: 1,
                    },
                ],
            });

            const erTypeLookupData = await RMService.i.lookupData.save(
                fullIdentifier,
                {
                    nip05: fullIdentifier,
                    names: {
                        [identifier]: dbSystemUser.pubkey,
                    },
                },
                {
                    directlyAddToInMemoryCache: true,
                }
            );

            // Update global stats.
            await bumpGlobalStats();

            res.json({ names: erTypeLookupData.data.names });
            return;
        }

        // 2. Check: The request is for an email account.
        if (identifier.startsWith("email_")) {
            // Query the SQL database (for now).
            const dbEmailNostr =
                await PrismaService.instance.db.emailNostr.findFirst({
                    where: {
                        nip05: fullIdentifier,
                    },
                    include: { email: true },
                });
            if (!dbEmailNostr) {
                // Store empty record in Redis to avoid future database queries.
                await RMService.i.lookupData.save(
                    fullIdentifier,
                    {
                        nip05: fullIdentifier,
                        names: {},
                    },
                    {
                        directlyAddToInMemoryCache: true,
                    }
                );

                res.json({
                    names: {},
                });
                return;
            }

            // Write to Redis to avoid SQL queries in the future.
            await RMService.i.lookupStats.save(fullIdentifier, {
                nip05: fullIdentifier,
                lastLookupAt: new Date().toISOString(),
                lookups: dbEmailNostr.lookups + 1,
                dailyLookups: [
                    {
                        date: today.toJSDate().toISOString(),
                        lookups: 1,
                    },
                ],
            });

            const erLookupData = await RMService.i.lookupData.save(
                fullIdentifier,
                {
                    nip05: fullIdentifier,
                    names: {
                        [identifier]: dbEmailNostr.pubkey,
                    },
                },
                {
                    directlyAddToInMemoryCache: true,
                }
            );

            // Update global stats.
            await bumpGlobalStats();
            res.json({ names: erLookupData.data.names });
            return;
        }

        // The only thing left is to check the SQL database for a registration.
        const dbRegistration =
            await PrismaService.instance.db.registration.findFirst({
                where: {
                    identifier: identifier,
                    systemDomain: {
                        name: domain,
                    },
                },
                include: {
                    registrationRelays: true,
                    user: true,
                },
            });

        if (!dbRegistration) {
            // No user found in the database.
            // Nevertheless, store an "empty" record in Redis to avoid
            // database queries in the future.
            await RMService.i.lookupData.save(
                fullIdentifier,
                {
                    nip05: fullIdentifier,
                    names: {},
                },
                {
                    directlyAddToInMemoryCache: true,
                }
            );

            res.json({
                names: {},
            });
            return;
        }

        const rLookupData: RedisTypeLookupData = {
            nip05: fullIdentifier,
            names: {
                [identifier]: dbRegistration.user.pubkey,
            },
        };
        const relays = dbRegistration.registrationRelays.map((x) => x.address);
        if (relays.length > 0) {
            rLookupData.relays = {
                [dbRegistration.user.pubkey]: relays,
            };
        }

        await RMService.i.lookupData.save(fullIdentifier, rLookupData, {
            directlyAddToInMemoryCache: true,
        });

        await RMService.i.lookupStats.save(fullIdentifier, {
            nip05: fullIdentifier,
            lastLookupAt: now.toJSDate().toISOString(),
            lookups: dbRegistration.nipped + 1,
            dailyLookups: [
                {
                    date: today.toJSDate().toISOString(),
                    lookups: 1,
                },
            ],
        });

        // Update global stats.
        await bumpGlobalStats();

        const nip05Response: Nip05 = {
            names: rLookupData.names,
        };
        if (relays.length > 0) {
            nip05Response.relays = rLookupData.relays;
        }

        res.json(nip05Response);
    } catch (error) {
        next(error);
    }
}

