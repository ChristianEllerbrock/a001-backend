import { NextFunction, Request, Response } from "express";
import { EnvService } from "../../services/env-service";
import { PrismaService } from "../../services/prisma-service";

const log = function (text: string | object) {
    console.log(`CHECK SUBSCRIPTIONS - [controller] - ${JSON.stringify(text)}`);
};

export async function checkSubscriptions(
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

    // Call async function WITHOUT await to directly return a value.
    runCheckSubscriptions();

    res.json("OK");
}

const runCheckSubscriptions = async function () {
    const now = new Date();

    //
    // 1. Check for subscriptions that have expired
    // => Downgrade them to the free plan (subscriptionId = 1).
    //
    const dbUsersWithExpiredSubscription =
        await PrismaService.instance.db.user.findMany({
            where: {
                subscriptionEnd: { gte: now },
            },
        });

    for (const user of dbUsersWithExpiredSubscription) {
        const oldSubscriptionId = user.subscriptionId;
        const newSubscriptionId = 1;

        await PrismaService.instance.db.user.update({
            where: { id: user.id },
            data: {
                subscriptionId: newSubscriptionId,
                subscriptionEnd: null,
            },
        });

        await PrismaService.instance.db.userSubscription.create({
            data: {
                userId: user.id,
                oldSubscriptionId,
                newSubscriptionId,
                pending: false,
                cancelled: false,
                createdAt: now,
            },
        });

        // Notify user about expiration.
        // todo
    }
};

