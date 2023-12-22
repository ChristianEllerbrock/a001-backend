import {
    Arg,
    Args,
    Authorized,
    Ctx,
    Mutation,
    Query,
    Resolver,
} from "type-graphql";
import { SubscriptionOutput } from "../../outputs/subscriptionOutput";
import { GraphqlContext } from "../../type-defs";
import { ChangeSubscriptionInput } from "../../inputs/change-subscription-input";
import { SubscriptionCalc } from "../../../common/subscription-calc";
import { UserOutput } from "../../outputs/user-output";
import { UserSubscriptionOutput } from "../../outputs/user-subscription-output";
import { EmailOutService } from "../../../services/email-out/email-out-service";
import { Subscription } from "@prisma/client";
import { DateTime } from "luxon";

@Resolver()
export class SubscriptionResolver {
    @Query((returns) => [SubscriptionOutput])
    async subscriptions(
        @Ctx() context: GraphqlContext
    ): Promise<SubscriptionOutput[]> {
        return await context.db.subscription.findMany({});
    }

    @Query((returns) => SubscriptionOutput, { nullable: true })
    async subscription(
        @Ctx() context: GraphqlContext,
        @Arg("id") id: number
    ): Promise<SubscriptionOutput | null> {
        return await context.db.subscription.findUnique({
            where: { id },
        });
    }

    @Authorized()
    @Mutation((returns) => UserOutput)
    async changeSubscriptionWithoutInvoice(
        @Ctx() context: GraphqlContext,
        @Args() args: ChangeSubscriptionInput
    ): Promise<UserOutput> {
        const userId = context.user?.userId;
        if (!userId) {
            throw new Error(
                "Could not determine your user object from the token. Aborting."
            );
        }

        const calculation = await SubscriptionCalc.exec(
            userId,
            args.subscriptionId,
            args.days
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
        const initialSubscriptionId = dbUser.subscriptionId;
        const initialSubscriptionName = dbUser.subscription.name;

        // Check, if the current plan and the current end date is the same as the
        // new plan and new end date.
        if (
            dbUser.subscription.id === calculation.subscriptionId &&
            dbUser.subscriptionEnd == calculation.subscriptionEnd
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
            await EmailOutService.instance.includeNip65Relays(
                dbUser.pubkey,
                Array.from(initialRelays)
            );
        if (
            relevantRelays.length > 0 &&
            updatedDbUser.subscriptionEnd != null
        ) {
            // DON'T wait for the async function.

            const change = this.#determineSubscriptionChange(
                dbUser.subscription,
                updatedDbUser.subscription
            );

            const message =
                `You changed your subscription plan from ${dbUser.subscription.name} to ${updatedDbUser.subscription.name}.` +
                ` Your updated subscription now ends at ${DateTime.fromJSDate(
                    updatedDbUser.subscriptionEnd
                ).toFormat("yyyy-MM-dd HH:mm")}.`;

            EmailOutService.instance.sendDMFromBot(
                dbUser.pubkey,
                relevantRelays,
                message
            );
        }

        return updatedDbUser;
    }

    #determineSubscriptionChange(
        oldSubscription: Subscription,
        newSubscription: Subscription
    ): "upgrade" | "downgrade" | "prolong" {
        if (oldSubscription.id === newSubscription.id) {
            return "prolong";
        }

        if (newSubscription.id > oldSubscription.id) {
            return "upgrade";
        }

        return "downgrade";
    }
}

