export enum RedisIndex {
    idxLookupStats = "idx:lookupStats",
    ixdGlobalLookupStats = "idx:globalLookupStats",
}

//////////////////////////////////////
// COLLECTIONS ///////////////////////
//////////////////////////////////////

/**
 * lookupStats:<id>
 * id = nip05 (e.g. chris@nip05.social)
 */
export interface R_LookupStats {
    nip05: string;
    lastLookupAt: string;
    lookups: number;
    dailyLookups: {
        date: string;
        lookups: number;
    }[];
}

/**
 * lookupData:<id>
 * id = nip05 (e.g. chris@nip05.social)
 */
export interface R_LookupData {
    nip05: string;
    names: { [key: string]: string };
    relays?: { [key: string]: string[] };
}

//////////////////////////////////////
// SINGLE OBJECTS ////////////////////
//////////////////////////////////////

/**
 * globalLookupStats
 */
export interface R_GlobalLookupStats {
    lastLookupAt: string;
    lookups: number;
    dailyLookups: {
        date: string;
        lookups: number;
    }[];
}

/**
 * globalUserStats
 */
export interface R_GlobalUserStats {
    noOfUsers: number;
    noOfRegistrations: number;
    noOfRegistrationsPerDomain: { [key: string]: number };
    lastRegistrations: {
        date: string;
        nip05: string;
    }[];
}

