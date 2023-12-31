import { Authorized, Ctx, FieldResolver, Resolver, Root } from "type-graphql";
import { UserSubscriptionOutput } from "../../outputs/user-subscription-output";
import { UserOutput } from "../../outputs/user-output";
import { SubscriptionOutput } from "../../outputs/subscriptionOutput";
import { UserSubscriptionInvoiceOutput } from "../../outputs/user-subscription-invoice-output";
import { GraphqlContext } from "../../type-defs";

@Resolver((of) => UserSubscriptionOutput)
export class UserSubscriptionResolverRelations {
    @FieldResolver((returns) => SubscriptionOutput)
    async oldSubscription(
        @Root() userSubscription: UserSubscriptionOutput,
        @Ctx() context: GraphqlContext
    ): Promise<SubscriptionOutput> {
        if (userSubscription.userId !== context.user?.userId) {
            throw new Error("Unauthorized.");
        }

        const dbObject = await context.db.subscription.findUnique({
            where: { id: userSubscription.oldSubscriptionId },
        });

        if (!dbObject) {
            throw new Error("Could not find old subscription relations.");
        }

        return dbObject;
    }

    @FieldResolver((returns) => SubscriptionOutput)
    async newSubscription(
        @Root() userSubscription: UserSubscriptionOutput,
        @Ctx() context: GraphqlContext
    ): Promise<SubscriptionOutput> {
        if (userSubscription.userId !== context.user?.userId) {
            throw new Error("Unauthorized.");
        }

        const dbObject = await context.db.subscription.findUnique({
            where: { id: userSubscription.newSubscriptionId },
        });

        if (!dbObject) {
            throw new Error("Could not find new subscription relations.");
        }

        return dbObject;
    }

    @FieldResolver((returns) => UserSubscriptionInvoiceOutput, {
        nullable: true,
    })
    async userSubscriptionInvoice(
        @Root() userSubscription: UserSubscriptionOutput,
        @Ctx() context: GraphqlContext
    ): Promise<UserSubscriptionInvoiceOutput | null> {
        if (userSubscription.userId !== context.user?.userId) {
            throw new Error("Unauthorized.");
        }

        return await context.db.userSubscriptionInvoice.findUnique({
            where: { userSubscriptionId: userSubscription.id },
        });
    }
}

