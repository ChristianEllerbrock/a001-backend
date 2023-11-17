import { NextFunction, Request, Response } from "express";
import { EnvService } from "../../services/env-service";
import { EmailOutboundService } from "../../services/email-outbound-service";

export async function emailOutKillRandomRelayController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const apiKey = req.headers["x-auth-token"];
    if (
        typeof apiKey === "undefined" ||
        apiKey !== EnvService.instance.env.API_ADMIN_KEY
    ) {
        res.sendStatus(401);
        return;
    }

    EmailOutboundService.instance.killRandomRelayConnection();
    res.json("OK");
}
