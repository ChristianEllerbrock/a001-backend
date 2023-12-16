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
        });

        return updatedDbUser;
    }
}

