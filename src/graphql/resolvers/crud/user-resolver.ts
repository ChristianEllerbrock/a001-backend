import { Args, Authorized, Ctx, Mutation, Query, Resolver } from "type-graphql";
import { FindUserInput } from "../../inputs/find-user-input";
import { RegistrationOutput } from "../../outputs/registration-output";
import { UserOutput } from "../../outputs/user-output";
import { GraphqlContext, Role } from "../../type-defs";
import { RMService } from "../../../services/redis-memory-service";
import {
    NonCollectionRedisTypes,
    RedisTypeGlobalUserStats,
} from "../../../types/redis/@types";

const updateGlobalUserStatsAfterUserDelete =
    async function (deletionsPerDomain: { [key: string]: number }) {
        const rGlobalUserStats =
            await RMService.x?.fetch<RedisTypeGlobalUserStats>(
                NonCollectionRedisTypes.RedisTypeGlobalUserStats
            );

        if (!rGlobalUserStats) {
            return;
        }

        rGlobalUserStats.noOfUsers--;

        let overallDeletions = 0;
        Object.entries(deletionsPerDomain).forEach((keyValue) => {
            overallDeletions += keyValue[1];

            if (
                typeof rGlobalUserStats.noOfRegistrationsPerDomain[
                    keyValue[0]
                ] !== "undefined"
            ) {
                rGlobalUserStats.noOfRegistrationsPerDomain[keyValue[0]] -=
                    keyValue[1];
            }
        });

        rGlobalUserStats.noOfRegistrations -= overallDeletions;

        await RMService.x?.save(
            NonCollectionRedisTypes.RedisTypeGlobalUserStats,
            rGlobalUserStats
        );
    };

@Resolver()
export class UserResolver {
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

    @Authorized([Role.Admin])
    @Query((returns) => [UserOutput])
    async admUsers(@Ctx() context: GraphqlContext): Promise<UserOutput[]> {
        return await context.db.user.findMany({});
    }

    @Authorized()
    @Mutation((returns) => String)
    async deleteMyUser(@Ctx() context: GraphqlContext): Promise<string> {
        const deletionsPerDomain = await context.db.$transaction(async (db) => {
            // Get all (verified) registrations of the user in order
            // to later update the global user stats.
            const dbRegistrations = await db.registration.findMany({
                where: {
                    userId: context.user?.userId,
                    verifiedAt: { not: null },
                },
                include: { systemDomain: true },
            });

            const deletionsPerDomain: { [key: string]: number } = {};
            for (const registration of dbRegistrations) {
                const domain = registration.systemDomain.name;
                if (typeof deletionsPerDomain[domain] === "undefined") {
                    deletionsPerDomain[domain] = 0;
                }
                deletionsPerDomain[domain]++;
            }
            await db.user.delete({ where: { id: context.user?.userId } });
            return deletionsPerDomain;
        });

        updateGlobalUserStatsAfterUserDelete(deletionsPerDomain);

        return context.user?.userId ?? "unknown";
    }
}

