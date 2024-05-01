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
    R_RelayEvent,
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
    relayEvent = new RedisMemoryCollectionRepository<R_RelayEvent>(
        "relayEvent",
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

            if (!indexes.includes(RedisIndex.idxRelayEvent)) {
                await this.#db.redis.ft.create(
                    RedisIndex.idxRelayEvent,
                    {
                        "$.id": {
                            type: SchemaFieldTypes.TAG,
                            AS: "id",
                        },
                        "$.pubkey": {
                            type: SchemaFieldTypes.TAG,
                            AS: "pubkey",
                        },
                        "$.created_at": {
                            type: SchemaFieldTypes.NUMERIC,
                            AS: "created_at",
                        },
                        "$.kind": {
                            type: SchemaFieldTypes.NUMERIC,
                            AS: "kind",
                        },
                        "$.content": {
                            type: SchemaFieldTypes.TEXT,
                            AS: "content",
                        },
                        "$._tags.a": {
                            type: SchemaFieldTypes.TAG,
                            AS: "a",
                        },
                        "$._tags.b": {
                            type: SchemaFieldTypes.TAG,
                            AS: "b",
                        },
                        "$._tags.c": {
                            type: SchemaFieldTypes.TAG,
                            AS: "c",
                        },
                        "$._tags.d": {
                            type: SchemaFieldTypes.TAG,
                            AS: "d",
                        },
                        "$._tags.e": {
                            type: SchemaFieldTypes.TAG,
                            AS: "e",
                        },
                        "$._tags.f": {
                            type: SchemaFieldTypes.TAG,
                            AS: "f",
                        },
                        "$._tags.g": {
                            type: SchemaFieldTypes.TAG,
                            AS: "g",
                        },
                        "$._tags.h": {
                            type: SchemaFieldTypes.TAG,
                            AS: "h",
                        },
                        "$._tags.i": {
                            type: SchemaFieldTypes.TAG,
                            AS: "i",
                        },
                        "$._tags.j": {
                            type: SchemaFieldTypes.TAG,
                            AS: "j",
                        },
                        "$._tags.k": {
                            type: SchemaFieldTypes.TAG,
                            AS: "k",
                        },
                        "$._tags.l": {
                            type: SchemaFieldTypes.TAG,
                            AS: "l",
                        },
                        "$._tags.m": {
                            type: SchemaFieldTypes.TAG,
                            AS: "m",
                        },
                        "$._tags.n": {
                            type: SchemaFieldTypes.TAG,
                            AS: "n",
                        },
                        "$._tags.o": {
                            type: SchemaFieldTypes.TAG,
                            AS: "o",
                        },
                        "$._tags.p": {
                            type: SchemaFieldTypes.TAG,
                            AS: "p",
                        },
                        "$._tags.q": {
                            type: SchemaFieldTypes.TAG,
                            AS: "q",
                        },
                        "$._tags.r": {
                            type: SchemaFieldTypes.TAG,
                            AS: "r",
                        },
                        "$._tags.s": {
                            type: SchemaFieldTypes.TAG,
                            AS: "s",
                        },
                        "$._tags.t": {
                            type: SchemaFieldTypes.TAG,
                            AS: "t",
                        },
                        "$._tags.u": {
                            type: SchemaFieldTypes.TAG,
                            AS: "u",
                        },
                        "$._tags.v": {
                            type: SchemaFieldTypes.TAG,
                            AS: "v",
                        },
                        "$._tags.w": {
                            type: SchemaFieldTypes.TAG,
                            AS: "w",
                        },
                        "$._tags.x": {
                            type: SchemaFieldTypes.TAG,
                            AS: "x",
                        },
                        "$._tags.z": {
                            type: SchemaFieldTypes.TAG,
                            AS: "z",
                        },
                        "$._tags.y": {
                            type: SchemaFieldTypes.TAG,
                            AS: "y",
                        },
                    },
                    {
                        ON: "JSON",
                        PREFIX: "relayEvent:",
                    }
                );
            }
        } catch (error) {
            console.log(error);
        }
    }
}

