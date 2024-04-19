import { Ctx, Query, Resolver } from "type-graphql";
import {
    RegistrationsPerDomainStatisticsOutput,
    UsageStatisticsOutput,
} from "../../outputs/usage-statistics-output";
import { GraphqlContext } from "../../type-defs";
import { DateTime } from "luxon";
import { RegistrationStatisticsOutput } from "../../outputs/statistics/registration-statistics-output";
import { LookupStatisticsOutput } from "../../outputs/statistics/lookup-statistics-output";
import { RMService } from "../../../services/redis-memory-service";
import { CronService } from "../../../services/cron-service";

const USAGE_STATISTICS = "usageStatistics";

@Resolver()
export class StatisticsResolver {
    @Query((returns) => UsageStatisticsOutput)
    async usageStatistics(
        @Ctx() context: GraphqlContext
    ): Promise<UsageStatisticsOutput> {
        // 1st: query the cache for previously stored (and still cached) value
        // const cachedValue =
        //     CacheService.instance.get<UsageStatisticsOutput>(USAGE_STATISTICS);
        // if (cachedValue) {
        //     return cachedValue;
        // }

        // 2nd: There was NO cache hit. Get the data from the database and cache the value.
        const now = DateTime.now();
        const yesterday = now.plus({ days: -1 });

        let redisGlobalUserStats = await CronService.i.getGlobalUserStats();

        let noOfUsers = 0;
        let noOfRegistrations = 0;
        let registrationsPerDomain: RegistrationsPerDomainStatisticsOutput[] =
            [];
        let lastRegistrations: RegistrationStatisticsOutput[] = [];

        if (redisGlobalUserStats) {
            noOfUsers = redisGlobalUserStats?.noOfUsers ?? 0;
            noOfRegistrations = redisGlobalUserStats?.noOfRegistrations ?? 0;
            lastRegistrations = (
                redisGlobalUserStats?.lastRegistrations ?? []
            ).map((x) => {
                return {
                    date: new Date(x.date),
                    identifier: x.nip05.split("@")[0],
                    domain: x.nip05.split("@")[1],
                    pubkey: "unknown",
                };
            });

            registrationsPerDomain = Object.keys(
                redisGlobalUserStats.noOfRegistrationsPerDomain
            ).map((x) => {
                return {
                    domain: x,
                    registrations:
                        redisGlobalUserStats?.noOfRegistrationsPerDomain[x] ??
                        0,
                };
            });
        }

        const todayString = now.startOf("day").toJSDate().toISOString();
        const yesterString = yesterday.startOf("day").toJSDate().toISOString();

        let noOfLookupsToday = 0;
        let noOfLookupsYesterday = 0;
        const erTypeGlobalLookupStats =
            await RMService.i.globalLookupStats.fetch();
        if (erTypeGlobalLookupStats) {
            noOfLookupsToday =
                erTypeGlobalLookupStats.data.dailyLookups.find(
                    (x) => x.date.slice(0, 10) === todayString.slice(0, 10)
                )?.lookups ?? 0;
            noOfLookupsYesterday =
                erTypeGlobalLookupStats.data.dailyLookups.find(
                    (x) => x.date.slice(0, 10) === yesterString.slice(0, 10)
                )?.lookups ?? 0;
        }

        const escapedTodayString = now
            .startOf("day")
            .toJSDate()
            .toISOString()
            .slice(0, 10)
            .replaceAll("-", "\\-");

        const erLookupStatss = await RMService.i.lookupStats.search(
            `@date:{${escapedTodayString}*}`
        );

        const lookups: LookupStatisticsOutput[] = [];
        for (const erLookupStats of erLookupStatss) {
            const todayDaily = erLookupStats.data.dailyLookups.find(
                (x) => x.date.slice(0, 10) === todayString.slice(0, 10)
            );
            lookups.push({
                identifier: erLookupStats.data.nip05.split("@")[0],
                domain: erLookupStats.data.nip05.split("@")[1],
                total: todayDaily?.lookups ?? 0,
                pubkey: "unknown",
            });
        }

        const top10Lookups = lookups
            .sortBy((x) => x.total, "desc")
            .slice(0, 10);

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

        //CacheService.instance.set(USAGE_STATISTICS, stats);

        return stats;
    }
}

