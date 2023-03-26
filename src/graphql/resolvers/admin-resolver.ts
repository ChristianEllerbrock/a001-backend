import { Authorized, Ctx, Query, Resolver } from "type-graphql";
import { StatOutput } from "../outputs/stat-output";
import { GraphqlContext } from "../type-defs";

@Resolver()
export class AdminResolver {

    @Authorized()
    @Query(returns => StatOutput, { nullable: true })
    async adminStats(@Ctx() context: GraphqlContext): Promise<StatOutput | null> {
        const isSystemUser = await context.user?.isSystemUser();
        if (!isSystemUser) {
            return null;
        }

        // The requester is system user (admin)- Provide data.

        const dbDailyLookups = await context.db.dailyLookup.findMany({
            orderBy: {
                date: "desc"
            },
            take: 1
        });
        const dbDailyLookup = dbDailyLookups.length === 1
            ? dbDailyLookups[0]
            : undefined;

        const dbStatUsers = await context.db.statUser.findMany({
            orderBy: {
                date: 'desc'
            },
            take: 1
        });
        const dbStatUser = dbStatUsers.length === 1
            ? dbStatUsers[0]
            : undefined;

        const statOutput: StatOutput = {
            noOfUsersDate: dbStatUser?.date ?? new Date(),
            noOfUsers: dbStatUser?.users ?? 0,
            noOfLookupsDate: dbDailyLookup?.date ?? new Date(),
            noOfLookups: dbDailyLookup?.nipped ?? 0
        };
        return statOutput;
    }
}