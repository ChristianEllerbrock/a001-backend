import { Args, Authorized, Ctx, Mutation, Query, Resolver } from "type-graphql";
import { FindUserInput } from "../inputs/find-user-input";
import { RegistrationOutput } from "../outputs/registration-output";
import { UserOutput } from "../outputs/user-output";
import { GraphqlContext } from "../type-defs";

@Resolver()
export class UserRelatedResolver {
    @Authorized()
    @Query((returns) => UserOutput)
    async myUser(@Ctx() context: GraphqlContext): Promise<UserOutput> {
        const dbUser = await context.db.user.findUnique({
            where: { id: context.user?.userId },
        });

        if (!dbUser) {
            throw new Error("Could not find user in database.");
        }

        return dbUser;
    }

    @Authorized()
    @Query((returns) => [RegistrationOutput])
    async myRegistrations(
        @Ctx() context: GraphqlContext
    ): Promise<RegistrationOutput[]> {
        if (!context.user) {
            return []; // this will NOT happen because of the @Authorized attribute
        }

        const dbRegistrations = await context.db.registration.findMany({
            where: { userId: context.user.userId },
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

