export enum RedisIndex {
    idxLookupStats = "idx:lookupStats",
    ixdGlobalLookupStats = "idx:globalLookupStats",
    idxRelayEvent = "idx:relayEvent",
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

/**
 * relayEvent:<id>
 * id = nostr event id
 */
export interface R_RelayEvent {
    id: string;
    pubkey: string;
    created_at: number;
    kind: number;
    tags: Array<string[]>;
    content: string;
    sig: string;

    // This is a generated object filled with tag value pairs
    // from the tags array. It is required for searching
    _tags: { [key: string]: string };
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

