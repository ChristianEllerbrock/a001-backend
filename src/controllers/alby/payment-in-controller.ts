import { NextFunction, Request, Response } from "express";
import { AlbyWebhookPaymentIn } from "../../services/alby-service";
import { PrismaService } from "../../services/prisma-service";
import { EnvService } from "../../services/env-service";
import { Nip05NostrService } from "../../services/nip05-nostr/nip05-nostr-service";
import { DateTime } from "luxon";

const log = function (text: string | object) {
    console.log(`[controller] - ALBY PAYMENT-IN - ${JSON.stringify(text)}`);
};

export async function paymentInController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    log("Triggered");
    log(req.body);

    handlePaymentIn(req);
    res.json("OK");
}

const handlePaymentIn = async function (req: Request) {
    const paymentIn = req.body as AlbyWebhookPaymentIn;

    if (
        paymentIn.metadata?.environment !== EnvService.instance.env.ENVIRONMENT
    ) {
        log(
            `Info: Invoice was created for other environment (${paymentIn.metadata?.environment}). Ignore it here.`
        );
        return;
    }

    const dbUserSubscriptionInvoice =
        await PrismaService.instance.db.userSubscriptionInvoice.findFirst({
            where: {
                userSubscriptionId: paymentIn.metadata?.userSubscriptionId,
                paymentHash: paymentIn.payment_hash,
            },
            include: { userSubscriptionInvoicePayment: true },
        });

    if (!dbUserSubscriptionInvoice) {
        log("Error: Could not find invoice.");
        return;
    }

    if (
        dbUserSubscriptionInvoice.userSubscriptionInvoicePayment?.settled ===
        true
    ) {
        log(
            "Error: A payment already was found in the database for the invoice."
        );
        return;
    }

    if (paymentIn.amount !== dbUserSubscriptionInvoice.amount) {
        log(
            `The payment amount (${paymentIn.amount}) does not match the invoice amount (${dbUserSubscriptionInvoice.amount}).`
        );
        return;
    }

    // Create payment in the database.
    const updatedDbUser = await PrismaService.instance.db.$transaction(
        async (tx) => {
            await tx.userSubscriptionInvoicePayment.create({
                data: {
                    settled: true,
                    settledAt: paymentIn.settled_at
                        ? new Date(paymentIn.settled_at)
                        : new Date(),
                    userSubscriptionInvoiceId: dbUserSubscriptionInvoice.id,
                },
            });

            // Update userSubscription and user in the database.
            const updatedDbUserSubscription = await tx.userSubscription.update({
                where: { id: dbUserSubscriptionInvoice.userSubscriptionId },
                data: {
                    pending: false,
                },
            });
            return await tx.user.update({
                where: { id: updatedDbUserSubscription.userId },
                data: {
                    subscriptionId: updatedDbUserSubscription.newSubscriptionId,
                    subscriptionEnd:
                        updatedDbUserSubscription.newSubscriptionEnd,
                },
                include: { subscription: true },
            });
        }
    );

    // Notify user
    log(`Settled, notify account '${updatedDbUser.pubkey}'.`);

    const relays = await Nip05NostrService.instance.getRelevantAccountRelays(
        updatedDbUser.pubkey
    );

    try {
        const message =
            `Thank you for subscribing to the plan '${updatedDbUser.subscription.name}'.` +
            ` Your subscription expires at ${DateTime.fromJSDate(
                updatedDbUser.subscriptionEnd ?? new Date()
            ).toFormat("yyyy-MM-dd HH:mm")}` +
            ` You can manage your subscriptions at any time on https://nip05.social`;

        const publishedRelays = await Nip05NostrService.instance.sendDMFromBot(
            updatedDbUser.pubkey,
            relays,
            message
        );
        log(`Notified on relays: ${publishedRelays.join(", ")}`);
    } catch (error) {
        log(JSON.stringify(error));
    }
};

