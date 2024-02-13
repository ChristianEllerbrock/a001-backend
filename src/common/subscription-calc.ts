import { DateTime } from "luxon";
import { SubscriptionCalcOutput } from "../graphql/outputs/subscription-calc-output";
import { PrismaService } from "../services/prisma-service";

type SubscriptionChange = "upgrade" | "downgrade" | "prolong";

export class SubscriptionCalc {
    static async exec(
        userId: string,
        subscriptionId: number,
        days: number,
        promoCodeId: number | undefined
    ): Promise<SubscriptionCalcOutput> {
        const now = DateTime.now();
        const dbUser = await PrismaService.instance.db.user.findUnique({
            where: { id: userId },
            include: { subscription: true },
        });
        const dbSubscriptions =
            await PrismaService.instance.db.subscription.findMany({});

        let promoAmount = 0;
        if (promoCodeId) {
            const dbPromoCode =
                await PrismaService.instance.db.promoCode.findUnique({
                    where: { id: promoCodeId },
                });
            promoAmount = (dbPromoCode?.sats ?? 0) * -1;
        }

        if (!dbUser) {
            throw new Error(`Could not find user with id '${userId}'`);
        }

        const changeRequest = SubscriptionCalc.#getSubscriptionChange(
            dbUser.subscriptionId,
            subscriptionId
        );

        if (changeRequest === "prolong") {
            // Stay on the same plan but add some days.
            if (!dbUser.subscriptionEnd) {
                throw new Error(
                    "Your subscription currently has no end date. It cannot be prolonged."
                );
            }

            const currentSubscriptionEndDate = DateTime.fromJSDate(
                dbUser.subscriptionEnd
            );

            // Calculate the new subscription end date.
            const newSubscriptionEndDate = currentSubscriptionEndDate.plus({
                days: days,
            });

            // Calculate the costs.
            const amount =
                Math.round(days / 30) * dbUser.subscription.satsPer30Days;

            return {
                subscriptionEnd: newSubscriptionEndDate.toJSDate(),
                days,
                subscriptionId,
                amount,
                promoAmount: promoAmount,
                invoiceAmount:
                    amount + promoAmount > 0 ? amount + promoAmount : 0,
            };
        }

        if (changeRequest === "downgrade") {
            if (subscriptionId === 1) {
                throw new Error("You cannot downgrade to the FREE plan.");
            }

            // Only valid situation is from subscriptionId 3 to subscriptionId 2
            if (!dbUser.subscriptionEnd) {
                throw new Error(
                    `The user's subscription (${dbUser.subscription.name}) currently has no end date. Please contact support to fix this.`
                );
            }

            // The user is downgrading from a higher plan into a lower plan.
            // 1. Calculate the remaining seconds in the "current" plan that the user already has paid.
            const currentSubscriptionEndDate = DateTime.fromJSDate(
                dbUser.subscriptionEnd
            );

            const remainingCurrentSubscriptionTimeInSeconds =
                currentSubscriptionEndDate.diff(now, "seconds").toObject()
                    .seconds ?? 0;

            const remainingSubscriptionSats =
                (remainingCurrentSubscriptionTimeInSeconds / (30 * 86400)) *
                dbUser.subscription.satsPer30Days;

            // 2. Calculate the upcoming seconds in the "new" plan that the user can "buy" with the remainingSubscriptionSats
            const newSubscription = dbSubscriptions.find(
                (x) => x.id === subscriptionId
            );
            if (!newSubscription) {
                throw new Error(
                    `Could not determine the new subscription for the id '${subscriptionId}'.`
                );
            }

            const remainingNewSubscriptionTimeInSeconds =
                (remainingSubscriptionSats / newSubscription.satsPer30Days) *
                30 *
                86400;

            let newSubscriptionEndDate = now.plus({
                seconds: remainingNewSubscriptionTimeInSeconds,
            });
            let newSubscriptionInvoiceAmount = 0;

            // 3. Calculate the requested days (if > 0) on top.
            if (days > 0) {
                // Calculate the new subscription end date.
                newSubscriptionEndDate = newSubscriptionEndDate.plus({
                    days: days,
                });

                // Calculate the costs.
                newSubscriptionInvoiceAmount =
                    Math.round(days / 30) * newSubscription.satsPer30Days;
            }

            return {
                subscriptionId,
                subscriptionEnd: newSubscriptionEndDate.toJSDate(),
                days,
                amount: newSubscriptionInvoiceAmount,
                promoAmount,
                invoiceAmount:
                    newSubscriptionInvoiceAmount + promoAmount > 0
                        ? newSubscriptionInvoiceAmount + promoAmount
                        : 0,
            };
        }

        // changeRequest === "upgrade"
        // Could be:
        // BASIC -> PRO
        // BASIC -> ADVANCED
        // PRO -> ADVANCED

        const newSubscription = dbSubscriptions.find(
            (x) => x.id === subscriptionId
        );
        if (!newSubscription) {
            throw new Error(
                `Could not determine the new subscription for the id '${subscriptionId}'.`
            );
        }

        // Situation 1: Upgrading from BASIC (with no end date)
        if (dbUser.subscriptionId === 1) {
            const newSubscriptionEndDate = now.plus({
                days: days,
            });
            const amount =
                Math.round(days / 30) * newSubscription.satsPer30Days;

            return {
                subscriptionId,
                subscriptionEnd: newSubscriptionEndDate.toJSDate(),
                days,
                amount,
                promoAmount,
                invoiceAmount:
                    amount + promoAmount > 0 ? amount + promoAmount : 0,
            };
        }

        // Situation 2: Upgrading from PRO with a remaining PRO time
        // 1. Calculate the remaining seconds in the "current" plan that the user already has paid.
        if (!dbUser.subscriptionEnd) {
            throw new Error(
                `The user's subscription (${dbUser.subscription.name}) currently has no end date. Please contact support to fix this.`
            );
        }

        const currentSubscriptionEndDate = DateTime.fromJSDate(
            dbUser.subscriptionEnd
        );

        const remainingCurrentSubscriptionTimeInSeconds =
            currentSubscriptionEndDate.diff(now, "seconds").toObject()
                .seconds ?? 0;

        const remainingCurrentSubscriptionSats =
            (remainingCurrentSubscriptionTimeInSeconds / (30 * 86400)) *
            dbUser.subscription.satsPer30Days;

        // 2. Calculate the seconds that the user can buy in the "new" plan with the remainingCurrentSubscriptionSats.
        const remainingNewSubscriptionTimeInSeconds =
            (remainingCurrentSubscriptionSats / newSubscription.satsPer30Days) *
            30 *
            86400;

        let newSubscriptionEndDate = now.plus({
            seconds: remainingNewSubscriptionTimeInSeconds,
        });
        let newSubscriptionInvoiceAmount = 0;

        // 3. Calculate the requested days (if > 0) on top.
        if (days > 0) {
            // Calculate the new subscription end date.
            newSubscriptionEndDate = newSubscriptionEndDate.plus({
                days: days,
            });

            // Calculate the costs.
            newSubscriptionInvoiceAmount =
                Math.round(days / 30) * newSubscription.satsPer30Days;
        }

        return {
            subscriptionId,
            subscriptionEnd: newSubscriptionEndDate.toJSDate(),
            days,
            amount: newSubscriptionInvoiceAmount,
            promoAmount,
            invoiceAmount:
                newSubscriptionInvoiceAmount + promoAmount > 0
                    ? newSubscriptionInvoiceAmount + promoAmount
                    : 0,
        };
    }

    static #getSubscriptionChange(
        currentSubscriptionId: number,
        intendedSubscriptionId: number
    ): SubscriptionChange {
        if (currentSubscriptionId === intendedSubscriptionId) {
            return "prolong";
        }

        if (intendedSubscriptionId > currentSubscriptionId) {
            return "upgrade";
        }

        return "downgrade";
    }
}

