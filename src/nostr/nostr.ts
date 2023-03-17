import { bech32 } from "@scure/base";
import * as secp256k1 from "@noble/secp256k1";
import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha256";
import { randomBytes } from "@noble/hashes/utils";
import { base64 } from "@scure/base";
import * as crypto from "node:crypto";

secp256k1.utils.hmacSha256Sync = (key, ...msgs) =>
    hmac(sha256, key, secp256k1.utils.concatBytes(...msgs));
secp256k1.utils.sha256Sync = (...msgs) =>
    sha256(secp256k1.utils.concatBytes(...msgs));

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

export class Nostr {
    // #region Public Methods

    static createEvent(create: {
        privkey: string;
        data: NostrEventCreateData;
    }): NostrEvent {
        const privkeyBytes = secp256k1.utils.hexToBytes(create.privkey);

        const utf8Encoder = new TextEncoder();
        const eventHash = sha256(
            utf8Encoder.encode(Nostr._serializeEvent(create.data))
        );
        const id = secp256k1.utils.bytesToHex(eventHash);
        const sig = secp256k1.utils.bytesToHex(
            secp256k1.schnorr.signSync(eventHash, privkeyBytes)
        );

        return {
            id,
            sig,
            ...create.data,
        };
    }

    /**
     * Converts an NPUB string into a HEX representation and
     * throws an exception if the provided string is not a valid NPUB.
     *
     * The returned object could look like this:
     *
     * {
     *
     *      represents: 'npub',
     *      hex: '6ceb2b11a787....5b15475810e81530747'
     *
     * }
     */
    static npubToHexObject(npub: string): NostrHexObject {
        const hexObject = Nostr._nSomethingToHexObject(npub);
        if (hexObject.represents !== "npub") {
            throw new Error("Invalid npub provided.");
        }

        return hexObject;
    }

    /**
     * Converts an NSEC string into a HEX representation and
     * throws an exception if the provided string is not a valid NSEC.
     */
    static nsecToHexObject(nsec: string): NostrHexObject {
        const hexObject = Nostr._nSomethingToHexObject(nsec);
        if (hexObject.represents !== "nsec") {
            throw new Error("Invalid nsec provided.");
        }

        return hexObject;
    }

    /**
     * Converts an NPUB or NSEC string into a HEX representation and throws an
     * exception if the provided string is not valid.
     */
    static nXXXToHexObject(nXXX: string): NostrHexObject {
        return Nostr._nSomethingToHexObject(nXXX);
    }

    static Pubkey2nPub(hex: string): string {
        const data = secp256k1.utils.hexToBytes(hex);
        const words = bech32.toWords(data);
        return bech32.encode("npub", words, 5000);
    }

    static Privkey2nSec(hex: string): string {
        const data = secp256k1.utils.hexToBytes(hex);
        const words = bech32.toWords(data);
        return bech32.encode("nsec", words, 5000);
    }

    static generatePrivKeyHexObject(): NostrHexObject {
        return {
            represents: "nsec",
            hex: secp256k1.utils.bytesToHex(secp256k1.utils.randomPrivateKey()),
        };
    }

    static getPubKeyHexObjectFromPrivKey(privkey: string): NostrHexObject {
        const pubkey = secp256k1.utils.bytesToHex(
            secp256k1.schnorr.getPublicKey(privkey)
        );
        return {
            represents: "npub",
            hex: pubkey,
        };
    }

    static async encryptDirectMessage(
        senderPrivkeyHex: string,
        receiverPubkeyHex: string,
        message: string
    ): Promise<string> {
        const key = secp256k1.getSharedSecret(
            senderPrivkeyHex,
            "02" + receiverPubkeyHex
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

    // #endregion Public Methods

    // #region Private Methods

    private static _nSomethingToHexObject(nSomething: string): NostrHexObject {
        const { prefix, words } = bech32.decode(nSomething, 5000);
        const data = new Uint8Array(bech32.fromWords(words));

        return {
            represents: prefix,
            hex: secp256k1.utils.bytesToHex(data),
        };
    }

    private static _serializeEvent(evt: NostrEventCreateData): string {
        if (!Nostr._validateEvent(evt))
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

    // #endregion Private Methods
}

