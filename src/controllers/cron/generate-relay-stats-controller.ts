import { NextFunction, Request, Response } from "express";
import { EnvService } from "../../services/env-service";
import { Nip05SocialRelay } from "../../relay/nip05-social-relay";
import { PrismaService } from "../../services/prisma-service";

const log = function (text: string | object) {
    console.log(`[controller] - RELAY STATS - ${JSON.stringify(text)}`);
};

export async function generateRelayStatsController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    log("Triggered");

    const apiKey = req.headers["x-auth-token"];
    if (
        typeof apiKey === "undefined" ||
        apiKey !== EnvService.instance.env.API_ADMIN_KEY
    ) {
        res.sendStatus(401);
        log("Invalid x-auth-token.");
        return;
    }

    runGenerateRelayStats();
    res.json("OK");
}

const runGenerateRelayStats = async function () {
    const connections = Nip05SocialRelay.i.getConnections();

    let noOfConnections = connections.length;
    let noOfAuthConnections = connections.filter(
        (x) => x.isAuthenticated
    ).length;
    let noOfEvents = await PrismaService.instance.db.relayEvent.count({});

    // Create database record
    await PrismaService.instance.db.relayStat.create({
        data: {
            date: new Date(),
            noOfConnections,
            noOfAuthConnections,
            noOfEvents,
        },
    });
};

