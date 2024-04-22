import { RedisMemorySaveOptions } from "./redis-memory";
import {
    RedisMemoryCollectionRepository,
    RedisMemorySingleRepository,
} from "./redis-memory-repository";

export class RedisMemoryCollectionType<TModel> {
    constructor(
        public id: string,
        public data: TModel,
        private repository: RedisMemoryCollectionRepository<TModel>
    ) {}

    async save(options?: RedisMemorySaveOptions) {
        return await this.repository.save(this.id, this.data, options);
    }

    async remove() {
        return await this.repository.remove(this.id);
    }
}

export class RedisMemorySingleType<TModel> {
    constructor(
        public data: TModel,
        private repository: RedisMemorySingleRepository<TModel>
    ) {}

    async save(options?: RedisMemorySaveOptions) {
        return await this.repository.save(this.data, options);
    }

    async remove() {
        return await this.repository.remove();
    }
}

