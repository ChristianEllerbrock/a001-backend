import * as utils from "@noble/curves/abstract/utils";
import { bech32 } from "@scure/base";
import { sha256 } from "@noble/hashes/sha256";
import { secp256k1, schnorr } from "@noble/curves/secp256k1";
import { NostrEvent, NostrEventCreateData } from "./nostr";
import { randomBytes } from "@noble/hashes/utils";
import * as crypto from "node:crypto";
import { base64 } from "@scure/base";

export type NostrHexObject = {
    represents: string;
    hex: string;
};

export type NostrPubkeyObject = {
    hex: string;
    npub: string;
};

export class NostrHelperV2 {
    static createEvent(create: {
        privkey: string;
        data: NostrEventCreateData;
    }): NostrEvent {
        const privkeyBytes = utils.hexToBytes(create.privkey);

        const utf8Encoder = new TextEncoder();
        const eventHash = sha256(
            utf8Encoder.encode(NostrHelperV2._serializeEvent(create.data))
        );
        const id = utils.bytesToHex(eventHash);
        const sig = utils.bytesToHex(schnorr.sign(eventHash, privkeyBytes));

        return {
            id,
            sig,
            ...create.data,
        };
    }

    static async encryptDirectMessage(
        senderPrivkey: string,
        receiverPubkey: string,
        message: string
    ): Promise<string> {
        const key = secp256k1.getSharedSecret(
            senderPrivkey,
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

        return `${ctb64}?iv=${ivb64}`;
    }

    static getCreatedAt(time: number | undefined = undefined) {
        if (typeof time === "undefined") {
            time = Date.now();
        }
        return Math.floor(time / 1000);
    }

    static pubkey2npub(hex: string): string {
        const data = utils.hexToBytes(hex);
        const words = bech32.toWords(data);
        return bech32.encode("npub", words, 5000);
    }

    static privkey2pubkey(hex: string): string {
        return utils.bytesToHex(schnorr.getPublicKey(hex));
    }

    static privkey2nsec(hex: string): string {
        const data = utils.hexToBytes(hex);
        const words = bech32.toWords(data);
        return bech32.encode("nsec", words, 5000);
    }

    //static npub2hex(npub: string): string {}

    static getNostrPubkeyObject(npubORhex: string): NostrPubkeyObject {
        // 1. Assume we got an npub.
        // Try to generate hex value.
        try {
            const hexObject = this._nSomething2hexObject(npubORhex);
            if (hexObject.represents !== "npub") {
                throw new Error("THe provided string is NOT an npub.");
            }

            // Everything is fine. The provided string IS an npub.
            return {
                hex: hexObject.hex,
                npub: npubORhex,
            };
        } catch (error) {
            // Continue.
        }

        // 2. Assume we got an hex.
        // Try to generate the npub.
        try {
            const npub = NostrHelperV2.pubkey2npub(npubORhex);
            return {
                hex: npubORhex,
                npub,
            };
        } catch (error) {
            // Continue;
        }

        throw new Error("Could not convert the provided string into npub/hex.");
    }

    // #region Private Methods

    private static _nSomething2hexObject(nSomething: string): NostrHexObject {
        const { prefix, words } = bech32.decode(nSomething, 5000);
        const data = new Uint8Array(bech32.fromWords(words));

        return {
            represents: prefix,
            hex: utils.bytesToHex(data),
        };
    }

    private static _validateEvent(event: NostrEventCreateData): boolean {
        if (typeof event.content !== "string") return false;
        if (typeof event.created_at !== "number") return false;
        if (typeof event.pubkey !== "string") return false;
        if (!event.pubkey.match(/^[a-f0-9]{64}$/)) return false;

        if (!Array.isArray(event.tags)) return false;
        for (let i = 0; i < event.tags.length; i++) {
            let tag = event.tags[i];
            if (!Array.isArray(tag)) return false;
            for (let j = 0; j < tag.length; j++) {
                if (typeof tag[j] === "object") return false;
            }
        }

        return true;
    }

    private static _serializeEvent(evt: NostrEventCreateData): string {
        if (!NostrHelperV2._validateEvent(evt))
            throw new Error(
                "can't serialize event with wrong or missing properties"
            );

        return JSON.stringify([
            0,
            evt.pubkey,
            evt.created_at,
            evt.kind,
            evt.tags,
            evt.content,
        ]);
    }

    // #endregion Private Methods
}

