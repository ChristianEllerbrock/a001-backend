import { Ctx, Query, Resolver } from "type-graphql";
import {
    RegistrationLookupStatisticsOutput,
    UsageStatisticsOutput,
} from "../outputs/usage-statistics-output";
import { GraphqlContext } from "../type-defs";
import { DateTime } from "luxon";
import { CacheService } from "../../services/cache-service";

const USAGE_STATISTICS = "usageStatistics";

@Resolver()
export class StatisticsResolver {
    @Query((returns) => UsageStatisticsOutput)
    async usageStatistics(
        @Ctx() context: GraphqlContext
    ): Promise<UsageStatisticsOutput> {
        // 1st: query the cache for previously stored (and still cached) value
        const cachedValue =
            CacheService.instance.get<UsageStatisticsOutput>(USAGE_STATISTICS);
        if (cachedValue) {
            return cachedValue;
        }

        // 2nd: There was NO cache hit. Get the data from the database and cache the value.
        const now = DateTime.now();
        const nowString = now.toJSDate().toISOString().slice(0, 10);
        const yesterday = now.plus({ days: -1 });
        const yesterdayString = yesterday.toJSDate().toISOString().slice(0, 10);

        const queryNoOfUsers = `SELECT 
            noOfUsers = COUNT(DISTINCT([user].pubkey))
            FROM 
            dbo.Registration registration
            LEFT JOIN dbo.[User] [user] ON registration.userId  = [user].id
            WHERE [user].[isSystemAgent] = 0 AND registration.id IS NOT NULL`;
        const result1 = await context.db.$queryRawUnsafe(queryNoOfUsers);
        const noOfUsers = (result1 as any[])[0].noOfUsers;

        const queryNoOfRegistrations = `SELECT 
            noOfRegistrations = COUNT(registration.id)
            FROM 
            dbo.Registration registration
            JOIN dbo.[User] [user] ON registration.userId  = [user].id
            WHERE [user].[isSystemAgent] = 0`;
        const result2 = await context.db.$queryRawUnsafe(
            queryNoOfRegistrations
        );
        const noOfRegistrations = (result2 as any[])[0].noOfRegistrations;

        const queryNoOfLookups = `SELECT
            noOfLookupsYesterday = SUM(IIF(registrationLookup.[date] = '${yesterdayString}',
                registrationLookup.total,
                0
            ))
            , noOfLookupsToday = SUM(IIF(registrationLookup.[date] = '${nowString}',
                registrationLookup.total,
                0
            ))
            FROM
            dbo.RegistrationLookup registrationLookup
            JOIN dbo.Registration registration ON registrationLookup.registrationId = registration.id
            JOIN dbo.[User] [user] ON [user].id = registration.userId 
            WHERE 
            registrationLookup.[date] in (
                (SELECT CONVERT (Date, GETDATE()) AS [Current Date]),
                (SELECT CONVERT (Date, DATEADD(DAY, -1, GETDATE()) ) AS [Current Date])
            )
            AND [user].isSystemAgent = 0`;
        const result3 = await context.db.$queryRawUnsafe(queryNoOfLookups);
        const noOfLookupsYesterday = (result3 as any[])[0].noOfLookupsYesterday;
        const noOfLookupsToday = (result3 as any[])[0].noOfLookupsToday;

        const queryLookups = `SELECT
            Top 10
            identifier = registration.identifier
            , domain = domain.name
            --, [date] = registrationLookup.[date] 
            , total = registrationLookup.total
            FROM
            dbo.RegistrationLookup registrationLookup
            JOIN dbo.Registration registration ON registrationLookup.registrationId = registration.id
            JOIN dbo.[User] [user] ON [user].id = registration.userId 
            JOIN dbo.SystemDomain domain ON registration.systemDomainId = domain.id
            WHERE 
            registrationLookup.[date] = (SELECT CONVERT (Date, GETDATE()))
            AND [user].isSystemAgent = 0
            order by registrationLookup.total DESC`;
        const result4 = await context.db.$queryRawUnsafe(queryLookups);
        const lookups = result4 as RegistrationLookupStatisticsOutput[];

        const stats: UsageStatisticsOutput = {
            noOfUsers,
            noOfRegistrations,
            noOfLookupsYesterday,
            noOfLookupsToday,
            date: now.toJSDate(),
            lookups,
        };

        CacheService.instance.set(USAGE_STATISTICS, stats);

        return stats;
    }
}

