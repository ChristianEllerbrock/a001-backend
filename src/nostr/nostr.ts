import { bech32 } from "@scure/base";
// import * as secp256k1 from "@noble/secp256k1";
import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha256";
import { randomBytes } from "@noble/hashes/utils";
import { base64 } from "@scure/base";
import * as crypto from "node:crypto";
import * as utils from "@noble/curves/abstract/utils";

// secp256k1.utils.hmacSha256Sync = (key, ...msgs) =>
//     hmac(sha256, key, secp256k1.utils.concatBytes(...msgs));
// secp256k1.utils.sha256Sync = (...msgs) =>
//     sha256(secp256k1.utils.concatBytes(...msgs));

export type NostrHexObject = {
    represents: string;
    hex: string;
};

export enum NostrEventKind {
    Metadata = 0,
    Text = 1,
    RecommendRelay = 2,
    Contacts = 3,
    EncryptedDirectMessage = 4,
    EventDeletion = 5,
    Reaction = 7,
    ChannelCreation = 40,
    ChannelMetadata = 41,
    ChannelMessage = 42,
    ChannelHideMessage = 43,
    ChannelMuteUser = 44,
}

export type NostrEvent = {
    id: string;
    sig: string;
    kind: NostrEventKind;
    tags: string[][];
    pubkey: string;
    content: string;
    created_at: number;
};

export type NostrEventCreateData = {
    kind: NostrEventKind;
    tags: string[][];
    pubkey: string;
    content: string;
    created_at: number;
};

export type NostrFilters = {
    /** A list of event ids or prefixes */
    ids?: string[];

    /** A list of pubkeys or prefixes, the pubkey of an event must be one of these */
    authors?: string[];

    /** A list of a kind numbers */
    kinds?: number[];

    /** A list of event ids that are referenced in an "e" tag  */
    "#e"?: string[];

    /** A list of pubkeys that are referenced in a "p" tag  */
    "#p"?: string[];

    /** An integer unix timestamp, events must be newer than this to pass */
    since?: number;

    /** An integer unix timestamp, events must be older than this to pass */
    until?: number;

    /** Maximum number of events to be returned in the initial query */
    limit?: number;
};

