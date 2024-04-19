import EventEmitter from "events";
import { createClient, RedisClientType, SearchOptions } from "redis";
import { RedisJSON } from "@redis/json/dist/commands";
import { TypedEventEmitter } from "./typed-event-emitter";
import { RedisMemoryCollectionTypes } from "./redis-memory-model";

export type RedisMemoryConfig = {
    redisUrl: string;

    /** Default "Time To Live" (in seconds) for an inMemory object.*/
    inMemoryTTL: number;
};

export type RedisMemorySaveOptions =
    | {
          /*
           * The TTL (in seconds) for the json once it is loaded into the inMemory cache.
           * Use with caution, as this can lead to memory leaks.
           *
           * Defaults to the inMemoryTTL from the config if not set.
           */
          ttlInSeconds?: number;
          /**
           * If set to "true", the json will directly be added to the inMemory cache.
           * This is useful if you expect that the json will be read soon.
           *
           * Defaults to "false" if not set.
           */
          directlyAddToInMemoryCache?: boolean;
      }
    | undefined;

type RedisMemoryEventType = {
    error: [error: any];
    debug: [level: "info" | "error", data: any];
};

export class RedisMemory extends TypedEventEmitter<RedisMemoryEventType> {
    static readonly logPrefix = "[RedisMemory] -";

    get redis() {
        return this.#redis;
    }

    #redis: RedisClientType;
    #inMemoryCache: Map<
        string,
        [json: RedisJSON, lastActionAt: number, ttlInSeconds: number]
    > = new Map();
    #inMemoryCacheTtl: Map<string, number> = new Map();
    #upcomingInMemoryCacheCleanupAt: number | undefined;

    constructor(public readonly config: RedisMemoryConfig) {
        super();

        this.#redis = createClient({
            url: config.redisUrl,
        });

        this.#redis.on("error", (err) => {
            this.emit("error", err);
        });
    }

    async connect() {
        await this.#redis.connect();
        this.emit(
            "debug",
            "info",
            `${RedisMemory.logPrefix} Connected to Redis`
        );
    }

    async disconnect() {
        await this.#redis.disconnect();
        this.emit(
            "debug",
            "info",
            `${RedisMemory.logPrefix} Disconnected from Redis`
        );
    }

    // async search<Collection extends keyof TModel & string>(
    //     collection: Collection,
    //     query: string,
    //     options: SearchOptions | undefined = undefined
    // ): Promise<Array<TModel[Collection]>> {
    //     const index = `idx:${collection}`;

    //     const relevantOptions = options ?? {
    //         LIMIT: { from: 0, size: 10000 },
    //     };

    //     const result = await this.#redis.ft.search(
    //         index,
    //         query,
    //         relevantOptions
    //     );
    //     return result.documents.map((x) => x.value as TModel[Collection]);
    // }

    async save<T>(
        key: string,
        record: T,
        options?: RedisMemorySaveOptions
    ): Promise<void> {
        await this.#save(key, record, options);
    }

    async fetch<T>(key: string): Promise<T | null | undefined> {
        return await this.#fetch<T>(key);
    }

    async #fetch<A>(key: string): Promise<A | null | undefined> {
        this.#inMemoryCacheCleanup();

        const inMemoryResult = this.#inMemoryCache.get(key);
        if (typeof inMemoryResult !== "undefined") {
            inMemoryResult[1] = Date.now();
            this.emit(
                "debug",
                "info",
                `${RedisMemory.logPrefix} In-Memory cache hit for ${key}`
            );
            return inMemoryResult[0] as A;
        }
        this.emit(
            "debug",
            "info",
            `${RedisMemory.logPrefix} In-Memory cache miss for ${key}. Querying Redis.`
        );

        if (!this.#redis.isOpen) {
            await this.#redis.connect();
        }

        const pathType = await this.#redis.json.type(key);
        if (!pathType) {
            return undefined;
        }

        const databaseResult = await this.#redis.json.get(key);
        const relevantTtl =
            this.#inMemoryCacheTtl.get(key) ?? this.config.inMemoryTTL;

        const now = Date.now();
        this.#inMemoryCache.set(key, [databaseResult, now, relevantTtl]);

        // Check if the need to update #upcomingInMemoryCacheCleanupAt
        if (
            typeof this.#upcomingInMemoryCacheCleanupAt === "undefined" ||
            now + relevantTtl * 1000 < this.#upcomingInMemoryCacheCleanupAt
        ) {
            this.#upcomingInMemoryCacheCleanupAt = now + relevantTtl * 1000;
        }

        return databaseResult as A;
    }

    async #save<A>(
        key: string,
        record: A,
        options?: RedisMemorySaveOptions
    ): Promise<void> {
        this.#inMemoryCacheCleanup();

        if (!this.#redis.isOpen) {
            await this.#redis.connect();
        }

        let relevantTtl = this.config.inMemoryTTL;
        if (options?.ttlInSeconds && options.ttlInSeconds > 0) {
            relevantTtl = options.ttlInSeconds;
            this.#inMemoryCacheTtl.set(key, relevantTtl);
        }

        this.emit(
            "debug",
            "info",
            `${
                RedisMemory.logPrefix
            } setJson for ${key} / TTL: ${relevantTtl} s / Add to In-Memory: ${
                options?.directlyAddToInMemoryCache ?? false
            }`
        );
        const setResult = await this.#redis.json.set(
            key,
            "$",
            record as RedisJSON
        );
        if (!setResult) {
            this.emit(
                "debug",
                "error",
                `${RedisMemory.logPrefix} - [ERROR] - setting in Redis failed.`
            );
            return;
        }

        if (options?.directlyAddToInMemoryCache) {
            const now = Date.now();
            this.#inMemoryCache.set(key, [
                record as RedisJSON,
                now,
                relevantTtl,
            ]);

            // Check if the need to update #upcomingInMemoryCacheCleanupAt
            if (
                typeof this.#upcomingInMemoryCacheCleanupAt === "undefined" ||
                now + relevantTtl * 1000 < this.#upcomingInMemoryCacheCleanupAt
            ) {
                this.#upcomingInMemoryCacheCleanupAt = now + relevantTtl * 1000;
            }
        }
    }

    /** Removes all objects from the inMemory cache where there TTL has expired. */
    #inMemoryCacheCleanup() {
        const now = Date.now();
        if (now < (this.#upcomingInMemoryCacheCleanupAt ?? 0)) {
            return;
        }

        const start = Date.now();
        this.emit(
            "debug",
            "info",
            `${RedisMemory.logPrefix} In-Memory cache cleanup started`
        );

        this.#upcomingInMemoryCacheCleanupAt = undefined;

        const toBeDeletedKeys: string[] = [];

        for (const keyValue of this.#inMemoryCache) {
            if ((Date.now() - keyValue[1][1]) / 1000 > keyValue[1][2]) {
                toBeDeletedKeys.push(keyValue[0]);
            }
        }

        toBeDeletedKeys.forEach((key) => {
            this.#inMemoryCache.delete(key);
        });

        // Recalculate the next #upcomingInMemoryCacheCleanupAt.
        let nextCleanupAt = -1;
        for (const value of this.#inMemoryCache.values()) {
            if (nextCleanupAt === -1) {
                nextCleanupAt = value[1] + value[2] * 1000;
                continue;
            }

            if (value[1] + value[2] * 1000 < nextCleanupAt) {
                nextCleanupAt = value[1] + value[2] * 1000;
            }
        }

        if (nextCleanupAt !== -1) {
            this.#upcomingInMemoryCacheCleanupAt = nextCleanupAt;
        }

        this.emit(
            "debug",
            "info",
            `${
                RedisMemory.logPrefix
            } In-Memory cache cleanup finished. Took ${Math.round(
                (Date.now() - start) / 1000
            ).toFixed(2)} seconds.`
        );
    }
}

