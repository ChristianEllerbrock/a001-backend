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

type SetJsonOptions =
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

export class RedisMemory<
    TModel extends RedisMemoryCollectionTypes
> extends TypedEventEmitter<RedisMemoryEventType> {
    static readonly logPrefix = "[RedisMemory] -";

    get client() {
        return this.#client;
    }

    #client: RedisClientType;
    #inMemoryCache: Map<
        string,
        [json: RedisJSON, lastActionAt: number, ttlInSeconds: number]
    > = new Map();
    #inMemoryCacheTtl: Map<string, number> = new Map();
    #upcomingInMemoryCacheCleanupAt: number | undefined;

    constructor(public readonly config: RedisMemoryConfig) {
        super();

        this.#client = createClient({
            url: config.redisUrl,
        });

        this.#client.on("error", (err) => {
            this.emit("error", err);
        });
    }

    async connect() {
        await this.#client.connect();
        this.emit(
            "debug",
            "info",
            `${RedisMemory.logPrefix} Connected to Redis`
        );
    }

    async disconnect() {
        await this.#client.disconnect();
        this.emit(
            "debug",
            "info",
            `${RedisMemory.logPrefix} Disconnected from Redis`
        );
    }

    async search<Collection extends keyof TModel & string>(
        collection: Collection,
        query: string,
        options: SearchOptions | undefined = undefined
    ): Promise<Array<TModel[Collection]>> {
        const index = `idx:${collection}`;

        const relevantOptions = options ?? {
            LIMIT: { from: 0, size: 10000 },
        };

        const result = await this.#client.ft.search(
            index,
            query,
            relevantOptions
        );
        return result.documents.map((x) => x.value as TModel[Collection]);
    }

    async setJson<Collection extends keyof TModel & string>(
        key: string,
        json: Record<string, any> | null,
        options?: SetJsonOptions
    ): Promise<boolean>;
    async setJson<Collection extends keyof TModel & string>(
        collection: Collection,
        key: string,
        json: TModel[Collection] | null,
        options?: SetJsonOptions
    ): Promise<boolean>;
    async setJson<Collection extends keyof TModel & string>(
        arg1: string | Collection,
        arg2: (Record<string, any> | null) | string,
        arg3?: SetJsonOptions | (TModel[Collection] | null),
        arg4?: SetJsonOptions
    ): Promise<boolean> {
        let key = "";
        try {
            let json: any;
            let options: SetJsonOptions;

            if (typeof arg2 !== "string") {
                // Variant 1 WITHOUT collection
                key = arg1 as string;
                json = arg2;
                options = arg3 as SetJsonOptions;
            } else {
                // Variant 2 WITH collection
                key = `${arg1 as Collection}:${arg2 as string}`;
                json = arg3 as TModel[Collection] | null;
                options = arg4 as SetJsonOptions;
            }

            this.#inMemoryCacheCleanup();

            if (!this.#client.isOpen) {
                await this.#client.connect();
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
            const setResult = await this.#client.json.set(
                key,
                "$",
                json as RedisJSON
            );
            if (!setResult) {
                this.emit(
                    "debug",
                    "error",
                    `${RedisMemory.logPrefix} - [ERROR] - setting in Redis failed.`
                );
                return false;
            }

            if (options?.directlyAddToInMemoryCache) {
                const now = Date.now();
                this.#inMemoryCache.set(key, [
                    json as RedisJSON,
                    now,
                    relevantTtl,
                ]);

                // Check if the need to update #upcomingInMemoryCacheCleanupAt
                if (
                    typeof this.#upcomingInMemoryCacheCleanupAt ===
                        "undefined" ||
                    now + relevantTtl * 1000 <
                        this.#upcomingInMemoryCacheCleanupAt
                ) {
                    this.#upcomingInMemoryCacheCleanupAt =
                        now + relevantTtl * 1000;
                }
            }
            return true;
        } catch (error) {
            this.emit(
                "error",
                `${RedisMemory.logPrefix} Error in getJson for key ${key}: ${error}`
            );
            this.emit(
                "debug",
                "error",
                `${RedisMemory.logPrefix} Error in getJson for key ${key}: ${error}`
            );
            return false;
        }
    }

    async fetch<T>(key: string): Promise<T | null | undefined> {
        this.#inMemoryCacheCleanup();

        const inMemoryResult = this.#inMemoryCache.get(key);
        if (typeof inMemoryResult !== "undefined") {
            inMemoryResult[1] = Date.now();
            this.emit(
                "debug",
                "info",
                `${RedisMemory.logPrefix} In-Memory cache hit for ${key}`
            );
            return inMemoryResult[0] as T;
        }
        this.emit(
            "debug",
            "info",
            `${RedisMemory.logPrefix} In-Memory cache miss for ${key}. Querying Redis.`
        );

        if (!this.#client.isOpen) {
            await this.#client.connect();
        }

        const pathType = await this.#client.json.type(key);
        if (!pathType) {
            return undefined;
        }

        const databaseResult = await this.#client.json.get(key);
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

        return databaseResult as T;
    }

    async collectionFetch<Collection extends keyof TModel & string>(
        collection: Collection,
        key: string
    ): Promise<TModel[Collection] | null | undefined> {
        try {
            this.#inMemoryCacheCleanup();

            const relevantKey = `${collection}:${key}`;

            const inMemoryResult = this.#inMemoryCache.get(relevantKey);
            if (typeof inMemoryResult !== "undefined") {
                inMemoryResult[1] = Date.now();
                this.emit(
                    "debug",
                    "info",
                    `${RedisMemory.logPrefix} In-Memory cache hit for ${relevantKey}`
                );
                return inMemoryResult[0] as TModel[Collection] | null;
            }
            this.emit(
                "debug",
                "info",
                `${RedisMemory.logPrefix} In-Memory cache miss for ${relevantKey}. Querying Redis.`
            );

            if (!this.#client.isOpen) {
                await this.#client.connect();
            }

            const pathType = await this.#client.json.type(relevantKey);
            if (!pathType) {
                return undefined;
            }

            const databaseResult = await this.#client.json.get(relevantKey);
            const relevantTtl =
                this.#inMemoryCacheTtl.get(relevantKey) ??
                this.config.inMemoryTTL;

            const now = Date.now();
            this.#inMemoryCache.set(relevantKey, [
                databaseResult,
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

            return databaseResult as TModel[Collection] | null;
        } catch (error) {
            this.emit(
                "error",
                `${RedisMemory.logPrefix} Error in getJson for key ${key}: ${error}`
            );
            this.emit(
                "debug",
                "error",
                `${RedisMemory.logPrefix} Error in getJson for key ${key}: ${error}`
            );
            return null;
        }
    }

    async getJson<T>(key: string): Promise<T | null | undefined>;
    async getJson<Collection extends keyof TModel & string>(
        collection: Collection,
        key: string
    ): Promise<TModel[Collection] | null | undefined>;
    async getJson<Collection extends keyof TModel & string>(
        arg1: Collection | string,
        arg2?: string
    ): Promise<any> {
        let key = "";
        let variant: "without collection" | "with collection" =
            "with collection";
        try {
            if (typeof arg2 === "string") {
                // Variant 1 WITH collection.
                key = `${arg1}:${arg2}`;
            } else {
                key = arg1;
                variant = "without collection";
            }

            this.#inMemoryCacheCleanup();

            const inMemoryResult = this.#inMemoryCache.get(key);
            if (typeof inMemoryResult !== "undefined") {
                inMemoryResult[1] = Date.now();
                this.emit(
                    "debug",
                    "info",
                    `${RedisMemory.logPrefix} In-Memory cache hit for ${key}`
                );
                return variant === "with collection"
                    ? (inMemoryResult[0] as TModel[Collection] | null)
                    : (inMemoryResult[0] as any);
            }
            this.emit(
                "debug",
                "info",
                `${RedisMemory.logPrefix} In-Memory cache miss for ${key}. Querying Redis.`
            );

            if (!this.#client.isOpen) {
                await this.#client.connect();
            }

            const pathType = await this.#client.json.type(key);
            if (!pathType) {
                return undefined;
            }

            const databaseResult = await this.#client.json.get(key);
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

            return variant === "with collection"
                ? (databaseResult as TModel[Collection] | null)
                : (databaseResult as any);
        } catch (error) {
            this.emit(
                "error",
                `${RedisMemory.logPrefix} Error in getJson for key ${key}: ${error}`
            );
            this.emit(
                "debug",
                "error",
                `${RedisMemory.logPrefix} Error in getJson for key ${key}: ${error}`
            );
            return null;
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

