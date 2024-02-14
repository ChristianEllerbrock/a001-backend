import {
    Arg,
    Args,
    Authorized,
    Ctx,
    Int,
    Mutation,
    Query,
    Resolver,
} from "type-graphql";
import { GraphqlContext } from "../../type-defs";
import { UserSubscriptionOutput } from "../../outputs/user-subscription-output";
import { AlbyService } from "../../../services/alby-service";
import { PrismaService } from "../../../services/prisma-service";
import { SubscriptionCalc } from "../../../common/subscription-calc";
import { ChangeSubscriptionInput } from "../../inputs/change-subscription-input";
import { Nip05NostrService } from "../../../services/nip05-nostr/nip05-nostr-service";
import { DateTime } from "luxon";
import { UserOutput } from "../../outputs/user-output";
import { PromoCode, UserSubscription } from "@prisma/client";
import { v4 } from "uuid";

@Resolver()
export class UserSubscriptionResolver {
    @Authorized()
    @Query((returns) => [UserSubscriptionOutput])
    async myUserSubscriptions(
        @Ctx() context: GraphqlContext
    ): Promise<UserSubscriptionOutput[]> {
        const now = Date.now();

        const dbUserSubscriptions = await context.db.userSubscription.findMany({
            where: { userId: context.user?.userId },
            include: {
                userSubscriptionInvoice: {
                    include: { userSubscriptionInvoicePayment: true },
                },
            },
        });

        // Check, if there are pending changes where the invoices have expired.
        const toBeCancelledIds: number[] = [];
        for (const dbUserSubscription of dbUserSubscriptions) {
            if (
                !dbUserSubscription.pending ||
                !dbUserSubscription.userSubscriptionInvoice
            ) {
                continue;
            }

            if (
                now >
                new Date(
                    dbUserSubscription.userSubscriptionInvoice.expiresAt
                ).getTime()
            ) {
                toBeCancelledIds.push(dbUserSubscription.id);
            }
        }

        await context.db.userSubscription.updateMany({
            where: { id: { in: toBeCancelledIds } },
            data: { cancelled: true, pending: false },
        });

        return await context.db.userSubscription.findMany({
            where: { userId: context.user?.userId },
            orderBy: {
                createdAt: "desc",
            },
        });
    }

    @Authorized()
    @Mutation((returns) => UserOutput)
    async createUserSubscriptionWithoutInvoice(
        @Ctx() context: GraphqlContext,
        @Args() args: ChangeSubscriptionInput
    ): Promise<UserOutput> {
        // Ignore the Promo Code here. It is not needed for this mutation.
        // Promo codes can only be used with creating an invoice.

        const userId = context.user?.userId;
        if (!userId) {
            throw new Error(
                "Could not determine your user object from the token. Aborting."
            );
        }

        const calculation = await SubscriptionCalc.exec(
            userId,
            args.subscriptionId,
            args.days,
            undefined
        );

        if (calculation.invoiceAmount > 0) {
            throw new Error(
                "The subscription change requires an invoice. You cannot change your subscription."
            );
        }

        const dbUser = await context.db.user.findUnique({
            where: { id: userId },
            include: { subscription: true },
        });
        if (!dbUser) {
            throw new Error(
                "Could not find you and your subscription in the database. Please try again later."
            );
        }

        const pendingUserSubscription =
            await context.db.userSubscription.findFirst({
                where: { userId: dbUser.id, pending: true },
            });
        if (pendingUserSubscription) {
            throw new Error(
                "You have a pending subscription change. Please cancel it before updating your subscription."
            );
        }

        const initialSubscriptionId = dbUser.subscriptionId;
        const initialSubscriptionName = dbUser.subscription.name;

        // Check, if the current plan and the current end date is the same as the
        // new plan and new end date.
        if (
            dbUser.subscription.id === calculation.subscriptionId &&
            (dbUser.subscriptionEnd?.getTime() ?? 0) ===
                calculation.subscriptionEnd.getTime()
        ) {
            throw new Error(
                "Your request does not change the current subscription. Aborting."
            );
        }

        // Perform the subscription change.
        // 1. Create Subscription History Record
        await context.db.userSubscription.create({
            data: {
                userId,
                createdAt: new Date(),
                pending: false,
                cancelled: false,
                oldSubscriptionId: dbUser.subscriptionId,
                newSubscriptionId: calculation.subscriptionId,
                newSubscriptionEnd: calculation.subscriptionEnd,
            },
        });

        // 2. Change current subscription data.
        const updatedDbUser = await context.db.user.update({
            where: { id: userId },
            data: {
                subscriptionId: calculation.subscriptionId,
                subscriptionEnd: calculation.subscriptionEnd,
            },
            include: { subscription: true },
        });

        // 3. Inform user about subscription change via Nostr.
        const dbData = await context.db.registration.findMany({
            where: { userId: dbUser.id },
            select: { registrationRelays: true },
        });
        const initialRelays = new Set<string>();
        for (const data of dbData) {
            data.registrationRelays
                .map((x) => x.address)
                .forEach((y) => initialRelays.add(y));
        }
        const relevantRelays =
            await Nip05NostrService.instance.includeNip65Relays(
                dbUser.pubkey,
                Array.from(initialRelays)
            );
        if (
            relevantRelays.length > 0 &&
            updatedDbUser.subscriptionEnd != null
        ) {
            // DON'T wait for the async function.
            const message =
                `You changed your subscription plan from ${dbUser.subscription.name} to ${updatedDbUser.subscription.name}.` +
                ` Your updated subscription now ends at ${DateTime.fromJSDate(
                    updatedDbUser.subscriptionEnd
                ).toFormat("yyyy-MM-dd HH:mm")}.`;

            Nip05NostrService.instance.sendDMFromBot(
                dbUser.pubkey,
                relevantRelays,
                message
            );
        }

        return updatedDbUser;
    }

    @Authorized()
    @Mutation((returns) => UserSubscriptionOutput)
    async createUserSubscriptionWithInvoice(
        @Ctx() context: GraphqlContext,
        @Args() args: ChangeSubscriptionInput
    ): Promise<UserSubscriptionOutput> {
        const now = new Date();
        const userId = context.user?.userId;
        if (!userId) {
            throw new Error(
                "Could not determine your user object from the token. Aborting."
            );
        }
        let dbPromoCode: PromoCode | null = null;
        if (args.promoCode !== null) {
            dbPromoCode = await context.db.promoCode.findUnique({
                where: {
                    code: args.promoCode,
                },
            });

            if (!dbPromoCode) {
                throw new Error("Invalid promo code");
            }

            if (!!dbPromoCode.pubkey) {
                // The promo code is intended for a specific pubkey only.
                const dbUser = await context.db.user.findUnique({
                    where: {
                        id: context.user?.userId,
                    },
                });

                if (!dbUser) {
                    throw new Error(
                        "We could not find your account in the database"
                    );
                }

                if (dbUser.pubkey !== dbPromoCode.pubkey) {
                    throw new Error(
                        "This promo code is not valid for your account"
                    );
                }
            }
        }

        const calculation = await SubscriptionCalc.exec(
            userId,
            args.subscriptionId,
            args.days,
            dbPromoCode?.id
        );

        if (calculation.amount === 0) {
            throw new Error(
                "The subscription change does not require an invoice. Please use the other mutation."
            );
        }

        const dbUser = await context.db.user.findUnique({
            where: { id: userId },
            include: { subscription: true },
        });

        if (!dbUser) {
            throw new Error(
                "Could not find you and your subscription in the database. Please try again later."
            );
        }

        const pendingUserSubscription =
            await context.db.userSubscription.findFirst({
                where: { userId: dbUser.id, pending: true },
            });
        if (pendingUserSubscription) {
            throw new Error(
                "You have a pending subscription change. Please cancel it before requesting a new one."
            );
        }

        const transactionResult =
            await PrismaService.instance.db.$transaction<UserSubscriptionOutput>(
                async (tx) => {
                    // Handle 2 situations:
                    // 1. The invoice amount is 0 due to the use of a promo code.
                    // 2. The invoice amount is > 0 and needs to be paid.

                    let dbUserSubscription: UserSubscription | null = null;

                    if (calculation.invoiceAmount === 0) {
                        // Situation 1

                        // 1. Create Subscription History Record as NOT PENDING
                        dbUserSubscription = await tx.userSubscription.create({
                            data: {
                                userId,
                                createdAt: new Date(),
                                pending: false, // IMPORTANT
                                cancelled: false,
                                oldSubscriptionId: dbUser.subscriptionId,
                                newSubscriptionId: calculation.subscriptionId,
                                newSubscriptionEnd: calculation.subscriptionEnd,
                                info: dbPromoCode ? "with promo code" : null,
                            },
                        });

                        // 2. Update the User table to reflect the new subscription.
                        await tx.user.update({
                            where: { id: userId },
                            data: {
                                subscriptionId:
                                    dbUserSubscription.newSubscriptionId,
                                subscriptionEnd:
                                    dbUserSubscription.newSubscriptionEnd,
                            },
                        });

                        // 3. Store a fake invoice in the database.
                        const dbUserSubscriptionInvoice =
                            await tx.userSubscriptionInvoice.create({
                                data: {
                                    userSubscriptionId: dbUserSubscription.id,
                                    amount: calculation.invoiceAmount,
                                    description: "na",
                                    expiresAt: now,
                                    paymentHash: v4(),
                                    paymentRequest: "na",
                                    createdAt: now,
                                    qrCodePng: "na",
                                    qrCodeSvg: "na",
                                },
                            });

                        // 4. Store a fake payment in the database.
                        await tx.userSubscriptionInvoicePayment.create({
                            data: {
                                userSubscriptionInvoiceId:
                                    dbUserSubscriptionInvoice.id,
                                settled: true,
                                settledAt: now,
                            },
                        });

                        // 5. Remove the promo code from the database.
                        await tx.promoCode.delete({
                            where: { id: dbPromoCode?.id ?? -1 },
                        });
                    } else {
                        // Situation 2
                        // Perform the subscription change.
                        // 1. Create Subscription History Record as PENDING
                        dbUserSubscription = await tx.userSubscription.create({
                            data: {
                                userId,
                                createdAt: new Date(),
                                pending: true, // IMPORTANT
                                cancelled: false,
                                oldSubscriptionId: dbUser.subscriptionId,
                                newSubscriptionId: calculation.subscriptionId,
                                newSubscriptionEnd: calculation.subscriptionEnd,
                                info: dbPromoCode ? "with promo code" : null,
                            },
                        });

                        // 2. Create the Alby invoice.
                        const invoiceDescription = "NIP05.social Subscription";
                        const albyInvoice =
                            await AlbyService.instance.createInvoice(
                                dbUserSubscription.id,
                                calculation.invoiceAmount,
                                invoiceDescription
                            );

                        // 3. Store the invoice in the database.
                        const dbUserSubscriptionInvoice =
                            await tx.userSubscriptionInvoice.create({
                                data: {
                                    userSubscriptionId: dbUserSubscription.id,
                                    amount: calculation.invoiceAmount,
                                    description: invoiceDescription,
                                    expiresAt: albyInvoice.expires_at,
                                    paymentHash: albyInvoice.payment_hash,
                                    paymentRequest: albyInvoice.payment_request,
                                    createdAt: now,
                                    qrCodePng: albyInvoice.qr_code_png,
                                    qrCodeSvg: albyInvoice.qr_code_svg,
                                },
                            });

                        // 4. Remove a promo code from the database if one was used.
                        if (dbPromoCode) {
                            await tx.promoCode.delete({
                                where: { id: dbPromoCode.id },
                            });
                        }
                    }

                    return dbUserSubscription;
                }
            );

        return transactionResult;
    }

    @Authorized()
    @Mutation((returns) => UserSubscriptionOutput)
    async cancelPendingUserSubscription(
        @Ctx() context: GraphqlContext,
        @Arg("userSubscriptionId", (type) => Int) userSubscriptionId: number
    ): Promise<UserSubscriptionOutput> {
        const dbUserSubscription = await context.db.userSubscription.findFirst({
            where: {
                id: userSubscriptionId,
                userId: context.user?.userId,
                pending: true,
            },
        });

        if (!dbUserSubscription) {
            throw new Error("Could not find pending subscription change.");
        }

        return await context.db.userSubscription.update({
            where: { id: dbUserSubscription.id },
            data: {
                pending: false,
                cancelled: true,
            },
        });
    }
}

