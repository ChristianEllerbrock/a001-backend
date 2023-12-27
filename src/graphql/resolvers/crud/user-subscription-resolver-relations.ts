import { Authorized, Ctx, FieldResolver, Resolver, Root } from "type-graphql";
import { UserSubscriptionOutput } from "../../outputs/user-subscription-output";
import { UserOutput } from "../../outputs/user-output";
import { SubscriptionOutput } from "../../outputs/subscriptionOutput";
import { UserSubscriptionInvoiceOutput } from "../../outputs/user-subscription-invoice-output";
import { GraphqlContext } from "../../type-defs";

@Resolver((of) => UserSubscriptionOutput)
export class UserSubscriptionResolverRelations {
    //@Authorized()
    // @FieldResolver((returns) => UserOutput)
    // async user(
    //     @Root() userSubscription: UserSubscriptionOutput,
    //     @Ctx() context: GraphqlContext
    // ): Promise<UserOutput> {
    //     const dbObject = await context.db.user.findUnique({
    //         where: { id: userSubscription.userId },
    //     });

    //     if (!dbObject) {
    //         throw new Error("Could not find user relations.");
    //     }

    //     return dbObject;
    // }

    //@Authorized()
    @FieldResolver((returns) => SubscriptionOutput)
    async oldSubscription(
        @Root() userSubscription: UserSubscriptionOutput,
        @Ctx() context: GraphqlContext
    ): Promise<SubscriptionOutput> {
        const dbObject = await context.db.subscription.findUnique({
            where: { id: userSubscription.oldSubscriptionId },
        });

        if (!dbObject) {
            throw new Error("Could not find old subscription relations.");
        }

        return dbObject;
    }

    //@Authorized()
    @FieldResolver((returns) => SubscriptionOutput)
    async newSubscription(
        @Root() userSubscription: UserSubscriptionOutput,
        @Ctx() context: GraphqlContext
    ): Promise<SubscriptionOutput> {
        const dbObject = await context.db.subscription.findUnique({
            where: { id: userSubscription.newSubscriptionId },
        });

        if (!dbObject) {
            throw new Error("Could not find new subscription relations.");
        }

        return dbObject;
    }

    @Authorized()
    @FieldResolver((returns) => UserSubscriptionInvoiceOutput, {
        nullable: true,
    })
    async userSubscriptionInvoice(
        @Root() userSubscription: UserSubscriptionOutput,
        @Ctx() context: GraphqlContext
    ): Promise<UserSubscriptionInvoiceOutput | null> {
        return await context.db.userSubscriptionInvoice.findUnique({
            where: { userSubscriptionId: userSubscription.id },
        });
    }
}

