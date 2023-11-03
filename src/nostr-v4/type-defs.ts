import { Event } from "nostr-tools";

export type FetchResult<T> = {
    value: T | undefined;
    event: Event | undefined;
    fromRelays: string[];
    foundOnRelays: string[];
};

export type RelayEvent = {
    event: Event;
    url: string;
};

export interface Nip11RID {
    name: string;
    description: string;
    pubkey: string;
    contact: string;
    supported_nips: number[];
    software: string;
    version: string;
    limitation?: {
        auth_required: boolean;
    };
}

export interface Nip65RelayList {
    url: string;
    operation: "read" | "write" | "read+write";
}
