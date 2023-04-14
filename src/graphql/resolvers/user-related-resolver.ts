import { Args, Authorized, Ctx, Mutation, Query, Resolver } from "type-graphql";
import { FindUserInput } from "../inputs/find-user-input";
import { RegistrationOutput } from "../outputs/registration-output";
import { UserOutput } from "../outputs/user-output";
import { GraphqlContext } from "../type-defs";

@Resolver()
export class UserRelatedResolver {
    @Query((returns) => UserOutput, { nullable: true })
    async myUser(@Ctx() context: GraphqlContext): Promise<UserOutput | null> {
        if (!context.user) {
            return null;
        }

        const isAuthenticated = await context.user.hasValidTokenAsync();

        if (!isAuthenticated) {
            return null;
        }

        const dbUser = await context.db.user.findUnique({
            where: { id: context.user.userId },
        });

        return dbUser;
    }

    @Query((returns) => [RegistrationOutput], { nullable: true })
    async myRegistrations(
        @Ctx() context: GraphqlContext
    ): Promise<RegistrationOutput[] | null> {
        if (!context.user) {
            return null;
        }

        const isAuthenticated = await context.user.hasValidTokenAsync();

        if (!isAuthenticated) {
            return null;
        }

        const dbRegistrations = await context.db.registration.findMany({
            where: {
                userId: context.user.userId,
                verifiedAt: {
                    not: null,
                },
            },
        });

        return dbRegistrations.sortBy((x) => x.identifier);
    }

    @Authorized()
    @Mutation((returns) => String)
    async deleteMyUser(@Ctx() context: GraphqlContext): Promise<string> {
        await context.db.user.delete({ where: { id: context.user?.userId } });
        return context.user?.userId ?? "unknown";
    }
}

