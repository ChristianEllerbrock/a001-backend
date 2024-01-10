import { NextFunction, Request, Response } from "express";
import { EnvService } from "../../services/env-service";
import { Nip05NostrService } from "../../services/nip05-nostr/nip05-nostr-service";
import { PrismaService } from "../../services/prisma-service";
import { sleep } from "../../helpers/sleep";
import { DateTime } from "luxon";

const log = function (text: string | object) {
    console.log(
        `[controller] - CHECK LAST SEEN NIP05 - ${JSON.stringify(text)}`
    );
};

export async function checkLastSeenNip05Controller(
    req: Request,
    res: Response,
    next: NextFunction
) {
    log("Triggered");

    const apiKey = req.headers["x-auth-token"];
    if (
        typeof apiKey === "undefined" ||
        apiKey !== EnvService.instance.env.API_ADMIN_KEY
    ) {
        res.sendStatus(401);
        log("Error: Invalid x-auth-token.");
        return;
    }

    checkLastSeenNip05();
    res.json("OK");
}

const checkLastSeenNip05 = async function () {
    const start = DateTime.now();

    const dbUsers = await PrismaService.instance.db.user.findMany({
        where: {
            isSystemUser: false,
            isSystemAgent: false,
        },
    });

    for (const dbUser of dbUsers) {
        sleep(2000); // To not stress the relays
        const lastSeenString =
            dbUser.lastSeenNip05 && dbUser.lastSeenNip05At
                ? `, last seen as ${
                      dbUser.lastSeenNip05
                  } at ${dbUser.lastSeenNip05At.toISOString()}`
                : ``;

        log(`Checking '${dbUser.pubkey}'${lastSeenString}`);

        try {
            const relevantRelays =
                await Nip05NostrService.instance.getRelevantAccountRelays(
                    dbUser.pubkey
                );
            log(`On ${relevantRelays.length} relays`);
            const event =
                await Nip05NostrService.instance.dmWatcher.fetchReplaceableEvent(
                    dbUser.pubkey,
                    [0],
                    relevantRelays
                );
            if (!event) {
                log(`No Kind0 found.`);
                continue;
            }

            const nip05 = JSON.parse(event.content)?.nip05;
            if (!nip05) {
                log(`No NIP-05 found in metadata.`);
                continue;
            }

            if (
                dbUser.lastSeenNip05At == null ||
                dbUser.lastSeenNip05At.getTime() <
                    new Date(event.created_at * 1000).getTime()
            ) {
                log(
                    `New data: ${nip05} at ${new Date(
                        event.created_at * 1000
                    ).toISOString()}`
                );
                await PrismaService.instance.db.user.update({
                    where: { id: dbUser.id },
                    data: {
                        lastSeenNip05: nip05,
                        lastSeenNip05At: new Date(event.created_at * 1000),
                    },
                });
            } else {
                log(`No new data found.`);
            }
        } catch (error) {
            log(`An error occurred: ${error}`);
        }
    }

    const minutes = start.diffNow("minutes").toObject().minutes;
    log(`Finished in ${minutes?.toFixed(1)} minutes`);
};

