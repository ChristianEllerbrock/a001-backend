import { SearchOptions } from "redis";
import { RedisMemory, RedisMemorySaveOptions } from "./redis-memory";
import {
    RedisMemoryCollectionType,
    RedisMemorySingleType,
} from "./redis-memory-type";

export class RedisMemoryCollectionRepository<TModel> {
    constructor(
        private readonly name: string,
        private getRedisMemory: () => RedisMemory | undefined
    ) {}

    async exists(id: string): Promise<boolean> {
        const redisMemory = this.getRedisMemory();
        if (typeof redisMemory === "undefined") {
            throw new Error("getRedisMemory is undefined");
        }

        return await redisMemory.exists(this.#buildRedisKey(id));
    }

    async search(
        query: string,
        options: SearchOptions = { LIMIT: { from: 0, size: 10000 } }
    ): Promise<RedisMemoryCollectionType<TModel>[]> {
        const redisMemory = this.getRedisMemory();
        if (typeof redisMemory === "undefined") {
            throw new Error("getRedisMemory is undefined");
        }

        const result = await redisMemory.redis.ft.search(
            this.#buildRedisIndex(),
            query,
            options
        );

        const erItems: RedisMemoryCollectionType<TModel>[] = [];
        for (const document of result.documents) {
            // documentid is the full key. We need to
            // extract the id from it.
            erItems.push(
                new RedisMemoryCollectionType(
                    this.#deconstructIdFromRedisKey(document.id),
                    document.value as TModel,
                    this
                )
            );
        }

        return erItems;
    }

    async fetch(
        id: string
    ): Promise<RedisMemoryCollectionType<TModel> | undefined | null> {
        const redisMemory = this.getRedisMemory();
        if (typeof redisMemory === "undefined") {
            throw new Error("getRedisMemory is undefined");
        }

        const rResult = await redisMemory.fetch<TModel>(
            this.#buildRedisKey(id)
        );

        if (typeof rResult === "undefined") {
            return undefined;
        }

        if (rResult === null) {
            return null;
        }

        return new RedisMemoryCollectionType<TModel>(id, rResult, this);
    }

    async save(
        id: string,
        record: TModel,
        options?: RedisMemorySaveOptions
    ): Promise<RedisMemoryCollectionType<TModel>> {
        const redisMemory = this.getRedisMemory();
        if (typeof redisMemory === "undefined") {
            throw new Error("getRedisMemory is undefined");
        }

        await redisMemory.save(this.#buildRedisKey(id), record, options);
        return new RedisMemoryCollectionType<TModel>(id, record, this);
    }

    async remove(id: string): Promise<void> {
        const redisMemory = this.getRedisMemory();
        if (typeof redisMemory === "undefined") {
            throw new Error("getRedisMemory is undefined");
        }

        await redisMemory.remove(this.#buildRedisKey(id));
    }

    #buildRedisKey(id: string): string {
        return `${this.name}:${id}`;
    }

    #deconstructIdFromRedisKey(key: string) {
        return key.replace(`${this.name}:`, "");
    }

    #buildRedisIndex() {
        return `idx:${this.name}`;
    }
}

export class RedisMemorySingleRepository<TModel> {
    constructor(
        private readonly key: string,
        private getRedisMemory: () => RedisMemory | undefined
    ) {}

    async exists(): Promise<boolean> {
        const redisMemory = this.getRedisMemory();
        if (typeof redisMemory === "undefined") {
            throw new Error("getRedisMemory is undefined");
        }

        return await redisMemory.exists(this.key);
    }

    async fetch(): Promise<RedisMemorySingleType<TModel> | undefined | null> {
        const redisMemory = this.getRedisMemory();
        if (typeof redisMemory === "undefined") {
            throw new Error("getRedisMemory is undefined");
        }

        const rResult = await redisMemory.fetch<TModel>(this.key);

        if (typeof rResult === "undefined") {
            return undefined;
        }

        if (rResult === null) {
            return null;
        }

        return new RedisMemorySingleType<TModel>(rResult, this);
    }

    async save(
        record: TModel,
        options?: RedisMemorySaveOptions
    ): Promise<RedisMemorySingleType<TModel>> {
        const redisMemory = this.getRedisMemory();
        if (typeof redisMemory === "undefined") {
            throw new Error("getRedisMemory is undefined");
        }

        await redisMemory.save(this.key, record, options);
        return new RedisMemorySingleType<TModel>(record, this);
    }
}

