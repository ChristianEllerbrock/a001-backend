/* eslint-disable @typescript-eslint/no-unused-vars */
import { Authorized, Ctx, Mutation, Query, Resolver } from "type-graphql";
import { UserOutput } from "../../outputs/user-output";
import { GraphqlContext, Role } from "../../type-defs";
import { RMService } from "../../../services/redis-memory-service";

const updateGlobalUserStatsAfterUserDelete =
    async function (deletionsPerDomain: { [key: string]: number }) {
        try {
            const erGlobalUserStats = await RMService.i.globalUserStats.fetch();
            if (!erGlobalUserStats) {
                return;
            }

            erGlobalUserStats.data.noOfUsers--;

            let overallDeletions = 0;
            Object.entries(deletionsPerDomain).forEach((keyValue) => {
                overallDeletions += keyValue[1];

                if (
                    typeof erGlobalUserStats.data.noOfRegistrationsPerDomain[
                        keyValue[0]
                    ] !== "undefined"
                ) {
                    erGlobalUserStats.data.noOfRegistrationsPerDomain[
                        keyValue[0]
                    ] -= keyValue[1];
                }
            });

            erGlobalUserStats.data.noOfRegistrations -= overallDeletions;

            await erGlobalUserStats.save();
        } catch (error) {
            console.error(
                "Error updating globalUserStats in Redis after user delete",
                error
            );
        }
    };

const deleteLookupDataAndLookupStatsAfterUserDelete = async function (
    fullIdentifiers: string[]
) {
    try {
        for (const fullIdentifier of fullIdentifiers) {
            await RMService.i.lookupData.remove(fullIdentifier);
            await RMService.i.lookupStats.remove(fullIdentifier);
        }
    } catch (error) {
        console.error(
            "Error deleting lookupData and lookupStats in Redis after user delete",
            error
        );
    }
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
        const result = await context.db.$transaction(
            async (
                db
            ): Promise<
                [fullIdentifiers: string[], { [key: string]: number }]
            > => {
                // Get all (verified) registrations of the user in order
                // to later update the global user stats.
                const dbRegistrations = await db.registration.findMany({
                    where: {
                        userId: context.user?.userId,
                        verifiedAt: { not: null },
                    },
                    include: { systemDomain: true },
                });
                const fullIdentifiers = dbRegistrations.map((x) => {
                    return `${x.identifier}@${x.systemDomain.name}`;
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
                return [fullIdentifiers, deletionsPerDomain];
            }
        );

        deleteLookupDataAndLookupStatsAfterUserDelete(result[0]);
        updateGlobalUserStatsAfterUserDelete(result[1]);

        return context.user?.userId ?? "unknown";
    }
}

