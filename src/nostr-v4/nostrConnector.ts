import {
    Event,
    EventTemplate,
    UnsignedEvent,
    getEventHash,
    getSignature,
    nip44,
} from "nostr-tools";
import { secp256k1 } from "@noble/curves/secp256k1";
import { randomBytes } from "@noble/hashes/utils";
import * as crypto from "node:crypto";
import { base64 } from "@scure/base";

export type NostrConnectorConfig = {
    pubkey: string;
    privkey: string;
};

export class NostrConnector {
    get conf() {
        return this.#conf;
    }

    #conf: NostrConnectorConfig;

    constructor(conf: NostrConnectorConfig) {
        this.#conf = conf;
    }

    async getPublicKey(): Promise<string> {
        return this.#conf.pubkey;
    }

    signEvent<K extends number = number>(
        eventTemplate: EventTemplate<K>
    ): Event<K> {
        const unsignedEvent: UnsignedEvent = {
            ...eventTemplate,
            pubkey: this.conf.pubkey,
        };

        const event: Event = {
            ...unsignedEvent,
            id: getEventHash(unsignedEvent),
            sig: getSignature(unsignedEvent, this.conf.privkey),
        };

        return event as Event<K>;
    }

    async generateDM(message: string, receiverPubkey: string): Promise<Event> {
        const key = secp256k1.getSharedSecret(
            this.conf.privkey,
            "02" + receiverPubkey
        );
        const normalizedKey = key.slice(1, 33);

        let iv = Uint8Array.from(randomBytes(16));

        const utf8Encoder = new TextEncoder();

        let plaintext = utf8Encoder.encode(message);
        let cryptoKey = await crypto.subtle.importKey(
            "raw",
            normalizedKey,
            { name: "AES-CBC" },
            false,
            ["encrypt"]
        );
        let ciphertext = await crypto.subtle.encrypt(
            { name: "AES-CBC", iv },
            cryptoKey,
            plaintext
        );
        let ctb64 = base64.encode(new Uint8Array(ciphertext));
        let ivb64 = base64.encode(new Uint8Array(iv.buffer));

        const content = `${ctb64}?iv=${ivb64}`;

        const eventTemplate: EventTemplate = {
            kind: 4,
            tags: [["p", receiverPubkey]],
            content,
            created_at: Math.floor(new Date().getTime() / 1000),
        };

        return this.signEvent(eventTemplate);
    }

    async decrypt(cipherText: string): Promise<string> {
        // if (this.conf.use === "nip-07" && window.nostr?.nip04) {
        //     const plaintext = await window.nostr.nip04.decrypt(
        //         this.conf.pubkey,
        //         cipherText
        //     );
        //     return plaintext;
        // }

        throw new Error("Not implemented yet.");
    }

    async encrypt(plainText: string): Promise<string> {
        // if (this.conf.use === "nip-07" && window.nostr?.nip04) {
        //     const cipherText = await window.nostr.nip04.encrypt(
        //         this.conf.pubkey,
        //         plainText
        //     );
        //     return cipherText;
        // }

        throw new Error("Not implemented yet.");
    }
}

