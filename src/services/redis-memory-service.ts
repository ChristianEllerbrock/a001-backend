import { SchemaFieldTypes } from "redis";
import {
    RedisMemory,
    RedisMemoryConfig,
} from "../common/redis-memory/redis-memory";
import {
    RedisIndex,
    R_GlobalLookupStats,
    R_GlobalUserStats,
    R_LookupData,
    R_LookupStats,
} from "../types/redis/@types";
import {
    RedisMemoryCollectionRepository,
    RedisMemorySingleRepository,
} from "../common/redis-memory/redis-memory-repository";

export class RMService {
    // #region Singleton

    static #i: RMService;

    /** Singleton instance. */
    static get i() {
        if (this.#i) {
            return this.#i;
        }

        this.#i = new RMService();
        return this.#i;
    }

    // #endregion Singleton

    get db() {
        return this.#db;
    }

    globalUserStats = new RedisMemorySingleRepository<R_GlobalUserStats>(
        "globalUserStats",
        () => this.db
    );
    globalLookupStats = new RedisMemorySingleRepository<R_GlobalLookupStats>(
        "globalLookupStats",
        () => this.db
    );

    // Collections
    lookupStats = new RedisMemoryCollectionRepository<R_LookupStats>(
        "lookupStats",
        () => this.db
    );
    lookupData = new RedisMemoryCollectionRepository<R_LookupData>(
        "lookupData",
        () => this.db
    );

    #db: RedisMemory | undefined;
    #isInitialized = false;

    getRM() {
        return this.db;
    }

    async init(config: RedisMemoryConfig) {
        if (this.#isInitialized) {
            return;
        }

        this.#db = new RedisMemory(config);
        this.#createIndexes();
        this.#isInitialized = true;
    }

    async #createIndexes() {
        if (!this.#db) {
            return;
        }

        try {
            await this.#db.connect();

            const indexes = await this.#db.redis.ft._list();

            if (!indexes.includes(RedisIndex.idxLookupStats)) {
                await this.#db.redis.ft.create(
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

