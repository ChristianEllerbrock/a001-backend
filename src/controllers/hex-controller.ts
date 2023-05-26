import { NextFunction, Request, Response } from "express";
import { NostrHelperV2 } from "../nostr/nostr-helper-2";

interface Query {
    value?: string;
}

export function hexController(req: Request, res: Response, next: NextFunction) {
    try {
        const query = req.query as Query;
        if (typeof query.value === "undefined") {
            throw new Error("Please provide the param 'value'.");
        }

        const hexObject = NostrHelperV2.getNostrPubkeyObject(query.value);
        res.json(hexObject);
    } catch (error) {
        next(error);
    }
}

