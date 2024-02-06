import { NextFunction, Request, Response } from "express";
import { EnvService } from "../../services/env-service";
import { Nip05SocialRelay } from "../../relay/nip05-social-relay";
import { PrismaService } from "../../services/prisma-service";
import { CronJobTypeId } from "../../prisma/@types";
import { DateTime } from "luxon";

const log = function (text: string | object) {
    console.log(`[controller] - RELAY STATS - ${JSON.stringify(text)}`);
};

export async function generateRelayStatsController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const now = new Date();
    log("Triggered");

    const apiKey = req.headers["x-auth-token"];
    if (
        typeof apiKey === "undefined" ||
        apiKey !== EnvService.instance.env.API_ADMIN_KEY
    ) {
        res.sendStatus(401);
        const message = "Invalid x-auth-token.";
        log(message);

        // Log to database
        await PrismaService.instance.db.cronJob.upsert({
            where: { typeId: CronJobTypeId.GenerateRelayStats },
            update: {
                lastRunAt: now,
                lastRunSuccess: false,
                lastRunDuration: 0,
                lastRunResult: message,
            },
            create: {
                typeId: CronJobTypeId.GenerateRelayStats,
                lastRunAt: now,
                lastRunSuccess: false,
                lastRunDuration: 0,
                lastRunResult: message,
            },
        });
        return;
    }

    const dbCronJob = await PrismaService.instance.db.cronJob.upsert({
        where: { typeId: CronJobTypeId.GenerateRelayStats },
        update: {
            lastRunAt: now,
            lastRunResult: null,
            lastRunDuration: null,
            lastRunSuccess: null,
        },
        create: {
            typeId: CronJobTypeId.GenerateRelayStats,
            lastRunAt: now,
        },
    });

    runGenerateRelayStats(dbCronJob.id, now);
    res.json("OK");
}

const runGenerateRelayStats = async function (
    cronJobId: number,
    cronJobStart: Date
) {
    const cronJobEventLog: string[] = [];

    try {
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

        // Log to database
        const duration = DateTime.now()
            .diff(DateTime.fromJSDate(cronJobStart), "seconds")
            .toObject().seconds;
        await PrismaService.instance.db.cronJob.update({
            where: { id: cronJobId },
            data: {
                lastRunSuccess: true,
                lastRunResult: cronJobEventLog.join("\n"),
                lastRunDuration: duration,
            },
        });
    } catch (error) {
        // ERROR CASE

        cronJobEventLog.push(JSON.stringify(error));

        // Log to database
        const duration = DateTime.now()
            .diff(DateTime.fromJSDate(cronJobStart), "seconds")
            .toObject().seconds;
        await PrismaService.instance.db.cronJob.update({
            where: { id: cronJobId },
            data: {
                lastRunSuccess: false,
                lastRunResult: cronJobEventLog.join("\n"),
                lastRunDuration: duration,
            },
        });
    }
};

