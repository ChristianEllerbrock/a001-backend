import { Event, EventTemplate, NostrEvent, finalizeEvent } from "nostr-tools";
import { secp256k1 } from "@noble/curves/secp256k1";
import { randomBytes } from "@noble/hashes/utils";
import * as crypto from "node:crypto";
import { base64 } from "@scure/base";
import { NostrHelperV2 } from "../nostr/nostr-helper-2";

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

    signEvent(eventTemplate: EventTemplate): NostrEvent {
        return finalizeEvent(
            eventTemplate,
            NostrHelperV2.hexToUint8Array(this.conf.privkey)
        );
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

    async decryptDM(event: Event): Promise<string> {
        let [ctb64, ivb64] = event.content.split("?iv=");
        let key = secp256k1.getSharedSecret(
            this.conf.privkey,
            "02" + event.pubkey
        );
        let normalizedKey = this.#getNormalizedX(key);

        let cryptoKey = await crypto.subtle.importKey(
            "raw",
            normalizedKey,
            { name: "AES-CBC" },
            false,
            ["decrypt"]
        );
        let ciphertext = base64.decode(ctb64);
        let iv = base64.decode(ivb64);

        let plaintext = await crypto.subtle.decrypt(
            { name: "AES-CBC", iv },
            cryptoKey,
            ciphertext
        );

        const utf8Decoder = new TextDecoder();

        let text = utf8Decoder.decode(plaintext);
        return text;
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

    #getNormalizedX(key: Uint8Array): Uint8Array {
        return key.slice(1, 33);
    }
}

