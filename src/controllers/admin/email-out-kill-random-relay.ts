import { NextFunction, Request, Response } from "express";
import { EnvService } from "../../services/env-service";
import { EmailOutService } from "../../services/email-out/email-out-service";

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

    EmailOutService.instance.killRandomRelayConnection();
    res.json("OK");
}

