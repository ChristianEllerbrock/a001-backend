import {
    RedisMemory,
    RedisMemoryConfig,
} from "../common/redis-memory/redis-memory";
import {
    RedisTypeGlobalLookupStats,
    RedisTypeLookupData,
    RedisTypeLookupStats,
} from "../types/redis/@types";

type MyModel = {
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

    // #endregion Singleton

    get db() {
        return this.#db;
    }

    #db: RedisMemory<MyModel> | undefined;

    init(config: RedisMemoryConfig) {
        this.#db = new RedisMemory<MyModel>(config);
    }
}

