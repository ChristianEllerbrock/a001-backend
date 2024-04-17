import { Ctx, Query, Resolver } from "type-graphql";
import {
    RegistrationsPerDomainStatisticsOutput,
    UsageStatisticsOutput,
} from "../../outputs/usage-statistics-output";
import { GraphqlContext } from "../../type-defs";
import { DateTime } from "luxon";
import { CacheService } from "../../../services/cache-service";
import { RegistrationStatisticsOutput } from "../../outputs/statistics/registration-statistics-output";
import { LookupStatisticsOutput } from "../../outputs/statistics/lookup-statistics-output";
import { RedisMemory } from "../../../common/redis-memory/redis-memory";
import { RedisMemoryService } from "../../../services/redis-memory-service";
import {
    RedisIndex,
    RedisTypeGlobalLookupStats,
    RedisTypeLookupStats,
} from "../../../types/redis/@types";

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
        const yesterday = now.plus({ days: -1 });

        const queryNoOfUsers = `SELECT 
            noOfUsers = COUNT(DISTINCT([user].pubkey))
            FROM 
            dbo.Registration registration
            LEFT JOIN dbo.[User] [user] ON registration.userId  = [user].id
            WHERE [user].[isSystemAgent] = 0 AND registration.id IS NOT NULL
            AND registration.verifiedAt IS NOT NULL`;
        const result1 = await context.db.$queryRawUnsafe(queryNoOfUsers);
        const noOfUsers = (result1 as any[])[0].noOfUsers;

        const queryNoOfRegistrations = `SELECT 
            noOfRegistrations = COUNT(registration.id)
            FROM 
            dbo.Registration registration
            JOIN dbo.[User] [user] ON registration.userId  = [user].id
            WHERE 
            registration.verifiedAt IS NOT NULL
            AND [user].[isSystemAgent] = 0`;
        const result2 = await context.db.$queryRawUnsafe(
            queryNoOfRegistrations
        );
        const noOfRegistrations = (result2 as any[])[0].noOfRegistrations;

        const todayString = now.startOf("day").toJSDate().toISOString();
        const yesterString = yesterday.startOf("day").toJSDate().toISOString();

        let noOfLookupsToday = 0;
        let noOfLookupsYesterday = 0;
        const redisTypeGlobalLookupStats =
            await RedisMemoryService.client?.getJson<RedisTypeGlobalLookupStats>(
                "globalLookupStats"
            );
        if (redisTypeGlobalLookupStats) {
            noOfLookupsToday =
                redisTypeGlobalLookupStats.dailyLookups.find(
                    (x) => x.date.slice(0, 10) === todayString.slice(0, 10)
                )?.lookups ?? 0;
            noOfLookupsYesterday =
                redisTypeGlobalLookupStats.dailyLookups.find(
                    (x) => x.date.slice(0, 10) === yesterString.slice(0, 10)
                )?.lookups ?? 0;
        }

        const escapedTodayString = now
            .startOf("day")
            .toJSDate()
            .toISOString()
            .slice(0, 10)
            .replaceAll("-", "\\-");

        const searchResult =
            (await RedisMemoryService.client?.search(
                "lookupStats",
                `@date:{${escapedTodayString}*}`
            )) ?? [];

        const lookups: LookupStatisticsOutput[] = [];
        for (const lookupStats of searchResult) {
            const todayDaily = lookupStats.dailyLookups.find(
                (x) => x.date.slice(0, 10) === todayString.slice(0, 10)
            );
            lookups.push({
                identifier: lookupStats.nip05.split("@")[0],
                domain: lookupStats.nip05.split("@")[1],
                total: todayDaily?.lookups ?? 0,
                pubkey: "unknown",
            });
        }

        const top10Lookups = lookups
            .sortBy((x) => x.total, "desc")
            .slice(0, 10);

        const queryLast10Registrations = `SELECT
            TOP 10
            [date] = registration.verifiedAt
            , registration.identifier
            , domain = domain.name
            , pubkey = [user].pubkey
            FROM
            dbo.Registration registration 
            JOIN dbo.[User] [user] ON [user].id = registration.userId 
            JOIN dbo.SystemDomain domain ON registration.systemDOmainId = domain.id
            WHERE 
            registration.verifiedAt IS NOT NULL
            AND [user].isSystemAgent = 0
            ORDER BY registration.verifiedAt DESC`;
        const result5 = await context.db.$queryRawUnsafe(
            queryLast10Registrations
        );
        const lastRegistrations = result5 as RegistrationStatisticsOutput[];

        const queryRegistrationsPerDomain = `SELECT
                domain = domain.name
                , registrations = ISNULL(bookedDomain.registrations, 0)
                FROM
                dbo.SystemDomain domain 
                LEFT JOIN
                (
                SELECT
                domain = domain.name
                , registrations = count(registration.id)
                FROM
                dbo.Registration registration 
                JOIN dbo.[User] [user] ON [user].id = registration.userId 
                JOIN dbo.SystemDomain domain ON registration.systemDOmainId = domain.id
                WHERE 
                registration.verifiedAt IS NOT NULL
                AND [user].isSystemAgent = 0
                GROUP BY domain.name
                ) bookedDomain on domain.name = bookedDomain.domain
                ORDER BY registrations DESC, domain`;
        const result6 = await context.db.$queryRawUnsafe(
            queryRegistrationsPerDomain
        );
        const registrationsPerDomain =
            result6 as RegistrationsPerDomainStatisticsOutput[];

        const stats: UsageStatisticsOutput = {
            noOfUsers,
            noOfRegistrations,
            noOfLookupsYesterday,
            noOfLookupsToday,
            date: now.toJSDate(),
            topLookupsToday: top10Lookups,
            lastRegistrations,
            registrationsPerDomain,
        };

        CacheService.instance.set(USAGE_STATISTICS, stats);

        return stats;
    }
}

