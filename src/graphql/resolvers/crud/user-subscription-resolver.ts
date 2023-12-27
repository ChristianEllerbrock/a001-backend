import { Authorized, Ctx, Query, Resolver } from "type-graphql";
import { GraphqlContext } from "../../type-defs";
import { UserSubscriptionOutput } from "../../outputs/user-subscription-output";

@Resolver()
export class UserSubscriptionResolver {
    @Authorized()
    @Query((returns) => [UserSubscriptionOutput])
    async mySubscriptions(
        @Ctx() context: GraphqlContext
    ): Promise<UserSubscriptionOutput[]> {
        return await context.db.userSubscription.findMany({
            where: { userId: context.user?.userId },
            orderBy: {
                createdAt: "desc",
            },
        });
    }
}

