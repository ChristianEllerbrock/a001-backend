import { NextFunction, Request, Response } from "express";
import { EnvService } from "../../services/env-service";
import { PrismaService } from "../../services/prisma-service";
import { AlbyService } from "../../services/alby-service";

const log = function (text: string | object) {
    console.log(
        `[controller] - CHECK UNSETTLED INVOICES - ${JSON.stringify(text)}`
    );
};

export async function checkUnsettledInvoicesController(
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
        log("Error: Invalid x-auth-token.");
        return;
    }

    checkUnsettledInvoices();
    res.json("OK");
}

const checkUnsettledInvoices = async function () {
    const pendingDbUserSubscriptions =
        await PrismaService.instance.db.userSubscription.findMany({
            where: { pending: true },
            include: {
                userSubscriptionInvoice: {
                    include: { userSubscriptionInvoicePayment: true },
                },
            },
        });

    for (const pendingDbUserSubscription of pendingDbUserSubscriptions) {
        if (
            !pendingDbUserSubscription.userSubscriptionInvoice ||
            pendingDbUserSubscription.userSubscriptionInvoice
                .userSubscriptionInvoicePayment
        ) {
            continue; // Ignore.
        }

        log(
            `Check '${pendingDbUserSubscription.userSubscriptionInvoice.paymentHash}'`
        );
        const info = await AlbyService.instance.queryInvoice(
            pendingDbUserSubscription.userSubscriptionInvoice.paymentHash
        );
        if (info.settled_at == null) {
            log("Not settled.");
        } else {
            if (
                info.amount !==
                pendingDbUserSubscription.userSubscriptionInvoice.amount
            ) {
                log(
                    `Settled, but the payment amount (${info.amount}) does not match the invoice amount (${pendingDbUserSubscription.userSubscriptionInvoice.amount}).`
                );
                continue;
            }

            // Everything is ok. Create entries in database.
            await PrismaService.instance.db.$transaction(async (tx) => {
                if (!pendingDbUserSubscription.userSubscriptionInvoice) {
                    return;
                }

                await tx.userSubscriptionInvoicePayment.create({
                    data: {
                        settled: true,
                        settledAt: info.settled_at
                            ? new Date(info.settled_at)
                            : new Date(),
                        userSubscriptionInvoiceId:
                            pendingDbUserSubscription.userSubscriptionInvoice
                                .id,
                    },
                });

                // Update userSubscription and user in the database.
                const updatedDbUserSubscription =
                    await tx.userSubscription.update({
                        where: {
                            id: pendingDbUserSubscription.id,
                        },
                        data: {
                            pending: false,
                        },
                    });
                const updatedDbUser = await tx.user.update({
                    where: { id: updatedDbUserSubscription.userId },
                    data: {
                        subscriptionId:
                            updatedDbUserSubscription.newSubscriptionId,
                        subscriptionEnd:
                            updatedDbUserSubscription.newSubscriptionEnd,
                    },
                });
            });
            log("Settled. Database updated.");
        }
    }
};

