import * as utils from "@noble/curves/abstract/utils";
import { bech32 } from "@scure/base";
import { schnorr } from "@noble/curves/secp256k1";
import { NostrPubkeyObject } from "./type-defs";

export class NostrHelperV2 {
    static uint8ArrayToHex(data: Uint8Array): string {
        return utils.bytesToHex(data);
    }

    static hexToUint8Array(data: string): Uint8Array {
        return utils.hexToBytes(data);
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

    static getNostrPubkeyObject(npubORhex: string): NostrPubkeyObject {
        // 1. Assume we got an npub.
        // Try to generate hex value.
        try {
            const hexObject = this.#nSomething2hexObject(npubORhex);
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

    static #nSomething2hexObject(nSomething: string): {
        represents: string;
        hex: string;
    } {
        const { prefix, words } = bech32.decode(nSomething, 5000);
        const data = new Uint8Array(bech32.fromWords(words));

        return {
            represents: prefix,
            hex: utils.bytesToHex(data),
        };
    }
}

