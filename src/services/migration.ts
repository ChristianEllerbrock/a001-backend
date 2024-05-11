import { sleep } from "../helpers/sleep";
import { createLogger } from "../relay/utils/common";
import { R_RelayEvent } from "../types/redis/@types";
import { PrismaService } from "./prisma-service";
import { RMService } from "./redis-memory-service";
const debug = createLogger("[Migration]");

export class Migration {
    // #region Singleton

    static #i: Migration;

    /** Singleton instance. */
    static get i() {
        if (this.#i) {
            return this.#i;
        }

        this.#i = new Migration();
        return this.#i;
    }

    // #endregion Singleton

    // async migrationFixGlobalStats() {
    //     // 213513
    //     // 3085613
    //     const erGlobalLookupStats = await RMService.i.globalLookupStats.fetch();

    //     console.log(erGlobalLookupStats?.data.lookups);

    //     if (!erGlobalLookupStats) {
    //         return;
    //     }
    //     erGlobalLookupStats.data.lookups =
    //         erGlobalLookupStats.data.lookups + 3085613;
    //     const asd = await erGlobalLookupStats.save();
    //     console.log(asd.data.lookups);
    // }

    // async migrateRelayEventsFromSqlToRedis() {
    //     try {
    //         debug("Migrate relay events from SQL to Redis");

    //         const dbRelayEvents =
    //             await PrismaService.instance.db.relayEvent.findMany({});

    //         debug(`Found ${dbRelayEvents.length} relay events in SQL`);
    //         let i = 1;
    //         for (const dbRelayEvent of dbRelayEvents) {
    //             debug(`${i} - Event id ${dbRelayEvent.id} ...`);

    //             const exists = await RMService.i.relayEvent.exists(
    //                 dbRelayEvent.id
    //             );
    //             if (exists) {
    //                 debug("exists in Redis. Skip.");
    //                 continue;
    //             }

    //             const tags = JSON.parse(dbRelayEvent.tags) as string[][];
    //             const _tags: { [key: string]: string } = {};

    //             for (const tag of tags) {
    //                 _tags[tag[0]] = tag[1];
    //             }

    //             const rRelayEvent: R_RelayEvent = {
    //                 id: dbRelayEvent.id,
    //                 kind: dbRelayEvent.kind,
    //                 pubkey: dbRelayEvent.pubkey,
    //                 created_at: dbRelayEvent.created_at,
    //                 content: dbRelayEvent.content,
    //                 sig: dbRelayEvent.sig,
    //                 tags,
    //                 _tags,
    //             };

    //             //debug(JSON.stringify(rRelayEvent, null, 2));
    //             await RMService.i.relayEvent.save(rRelayEvent.id, rRelayEvent);
    //             debug(`${i} - Saved to Redis`);
    //             await sleep(100);
    //             i++;
    //         }
    //     } catch (error) {
    //         console.error(error);
    //     }
    // }
}

