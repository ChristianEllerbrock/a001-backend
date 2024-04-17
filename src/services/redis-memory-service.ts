import { SchemaFieldTypes } from "redis";
import {
    RedisMemory,
    RedisMemoryConfig,
} from "../common/redis-memory/redis-memory";
import {
    RedisIndex,
    RedisTypeGlobalLookupStats,
    RedisTypeLookupData,
    RedisTypeLookupStats,
} from "../types/redis/@types";

type MyCollectionTypes = {
    globalLookupStats: RedisTypeGlobalLookupStats;
    lookupStats: RedisTypeLookupStats;
    lookupData: RedisTypeLookupData;
};

export class RedisMemoryService {
    // #region Singleton

    static #i: RedisMemoryService;

    /** Singleton instance. */
    static get i() {
        if (this.#i) {
            return this.#i;
        }

        this.#i = new RedisMemoryService();
        return this.#i;
    }

    static get client() {
        if (this.#i) {
            return this.#i.#db;
        }

        this.#i = new RedisMemoryService();
        return this.#i.db;
    }

    // #endregion Singleton

    get db() {
        return this.#db;
    }

    #db: RedisMemory<MyCollectionTypes> | undefined;
    #isInitialized = false;

    async init(config: RedisMemoryConfig) {
        if (this.#isInitialized) {
            return;
        }

        this.#db = new RedisMemory<MyCollectionTypes>(config);
        this.#createIndexes();
        this.#isInitialized = true;
    }

    async #createIndexes() {
        if (!this.#db) {
            return;
        }

        try {
            await this.#db.connect();

            const indexes = await this.#db.client.ft._list();

            if (!indexes.includes(RedisIndex.idxLookupStats)) {
                await this.#db.client.ft.create(
                    RedisIndex.idxLookupStats,
                    {
                        "$.dailyLookups[*].date": {
                            type: SchemaFieldTypes.TAG,
                            AS: "date",
                        },
                    },
                    {
                        ON: "JSON",
                        PREFIX: "lookupStats:",
                    }
                );
            }
        } catch (error) {
            console.log(error);
        }
    }
}

