import { NextFunction, Request, Response } from "express";
import { generatePrivateKey, getPublicKey } from "nostr-tools";

export async function genKeyPairController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const privkey = generatePrivateKey();
    const pubkey = getPublicKey(privkey);

    res.json({
        pubkey,
        privkey,
    });
}

