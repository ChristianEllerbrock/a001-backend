import { Ctx, Query, Resolver } from "type-graphql";
import { UserTokenOutput } from "../outputs/user-token-output";
import { GraphqlContext, updateUserToken } from "../type-defs";

@Resolver()
export class AuthResolver {
    @Query((returns) => UserTokenOutput, { nullable: true })
    async isAuthenticated(@Ctx() context: GraphqlContext): Promise<UserTokenOutput | null> {
        if (!context.user) {
            return null;
        }

        const hasValidToken = await context.user.hasValidTokenAsync();
        if (!hasValidToken) {
            return null;
        }

        return await updateUserToken(context.user.userId);
    }
}