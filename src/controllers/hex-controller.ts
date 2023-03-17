import { NextFunction, Request, Response } from "express";
import { Nostr } from "../nostr/nostr";

interface Query {
    value?: string;
}

export function hexController(req: Request, res: Response, next: NextFunction) {
    try {
        const query = req.query as Query;
        if (typeof query.value === "undefined") {
            throw new Error("Please provide the param 'value'.");
        }

        const hexObject = Nostr.nXXXToHexObject(query.value);
        res.json(hexObject);
    } catch (error) {
        next(error);
    }
}

