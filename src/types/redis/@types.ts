export enum RedisIndex {
    idxLookupStats = "idx:lookupStats",
    ixdGlobalLookupStats = "idx:globalLookupStats",
}

export interface RedisTypeLookupStats {
    nip05: string;
    lastLookupAt: string;
    lookups: number;
    dailyLookups: {
        date: string;
        lookups: number;
    }[];
}

export interface RedisTypeGlobalLookupStats {
    lastLookupAt: string;
    lookups: number;
    dailyLookups: {
        date: string;
        lookups: number;
    }[];
}

export interface RedisTypeLookupData {
    nip05: string;
    names: { [key: string]: string };
    relays?: { [key: string]: string[] };
}

export enum NonCollectionRedisTypes {
    RedisTypeGlobalLookupStats = "globalLookupStats",
}

