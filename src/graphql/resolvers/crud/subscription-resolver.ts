import { Arg, Ctx, Query, Resolver } from "type-graphql";
import { SubscriptionOutput } from "../../outputs/subscriptionOutput";
import { GraphqlContext } from "../../type-defs";

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
}

