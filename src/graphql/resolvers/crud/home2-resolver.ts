import { Query, Resolver } from "type-graphql";
import { CronService } from "../../../services/cron-service";
import { RMService } from "../../../services/redis-memory-service";
import { HomeStatsOutput } from "../../outputs/home-stats-output";

@Resolver()
export class Home2Resolver {
    @Query(() => HomeStatsOutput)
    async homeStats(): Promise<HomeStatsOutput> {
        const redisGlobalUserStats = await CronService.i.getGlobalUserStats();
        const erTypeGlobalLookupStats =
            await RMService.i.globalLookupStats.fetch();

        return {
            users: redisGlobalUserStats?.noOfUsers ?? 0,
            lookups: erTypeGlobalLookupStats?.data.lookups ?? 0,
        };
    }
}

