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

export interface RedisTypeGlobalUserStats {
    noOfUsers: number;
    noOfRegistrations: number;
    noOfRegistrationsPerDomain: { [key: string]: number };
    lastRegistrations: {
        date: string;
        nip05: string;
    }[];
}

export interface RedisTypeLookupData {
    nip05: string;
    names: { [key: string]: string };
    relays?: { [key: string]: string[] };
}

export enum NonCollectionRedisTypes {
    RedisTypeGlobalLookupStats = "globalLookupStats",
    RedisTypeGlobalUserStats = "globalUserStats",
}

