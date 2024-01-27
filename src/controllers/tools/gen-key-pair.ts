import { NextFunction, Request, Response } from "express";
import { generateSecretKey, getPublicKey } from "nostr-tools";
import { NostrHelperV2 } from "../../nostr/nostr-helper-2";

export async function genKeyPairController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const secretKey = generateSecretKey();
    const pubkey = getPublicKey(secretKey);
    NostrHelperV2.uint8ArrayToHex(secretKey);
    res.json({
        pubkey,
        privkey: NostrHelperV2.uint8ArrayToHex(secretKey),
    });
}

