/* eslint-disable @typescript-eslint/no-explicit-any */
import { R_GlobalUserStats } from "../types/redis/@types";
import { RMService } from "./redis-memory-service";
import { RegistrationsPerDomainStatisticsOutput } from "../graphql/outputs/usage-statistics-output";
import { RegistrationStatisticsOutput } from "../graphql/outputs/statistics/registration-statistics-output";
import { PrismaService } from "./prisma-service";
import { TypedEventEmitter } from "../common/redis-memory/typed-event-emitter";

type CronServiceEventType = {
    debug: [level: "info" | "error", data: any];
};

export class CronService extends TypedEventEmitter<CronServiceEventType> {
    // #region Singleton

    static #i: CronService;

    static get i() {
        if (this.#i) {
            return this.#i;
        }

        this.#i = new CronService();
        return this.#i;
    }

    // #endregion Singleton

    #lastGetGlobalUserStatsFromSqlDatabaseAt: number = 0;
    readonly #logPrefix = "[CronService] -";

    /**
     * Fetches the globalUserStats object from Redis but updates it
     * with data from the SQL database if the defined TTL (1 hour) has expired.
     */
    async getGlobalUserStats(): Promise<R_GlobalUserStats | undefined | null> {
        const ttlInSeconds = 60 * 60;

        try {
            const diffInSeconds =
                (Date.now() - this.#lastGetGlobalUserStatsFromSqlDatabaseAt) /
                1000;

            let rGlobalUserStats: R_GlobalUserStats | undefined | null;
            if (diffInSeconds > ttlInSeconds) {
                const start = Date.now();
                this.emit(
                    "debug",
                    "info",
                    `${
                        this.#logPrefix
                    } getGlobalUserStats(): Fetching data from SQL database...`
                );

                await PrismaService.instance.db.$transaction(async (db) => {
                    let noOfUsers = 0;
                    let noOfRegistrations = 0;
                    let registrationsPerDomain: RegistrationsPerDomainStatisticsOutput[] =
                        [];
                    let lastRegistrations: RegistrationStatisticsOutput[] = [];

                    // Get the data from the SQL database and update Redis.
                    const queryNoOfUsers = `SELECT 
                    noOfUsers = COUNT(DISTINCT([user].pubkey))
                    FROM 
                    dbo.Registration registration
                    LEFT JOIN dbo.[User] [user] ON registration.userId  = [user].id
                    WHERE [user].[isSystemAgent] = 0 AND registration.id IS NOT NULL
                    AND registration.verifiedAt IS NOT NULL`;
                    const result1 = await db.$queryRawUnsafe(queryNoOfUsers);
                    noOfUsers = (result1 as any[])[0].noOfUsers;

                    const queryNoOfRegistrations = `SELECT 
                    noOfRegistrations = COUNT(registration.id)
                    FROM 
                    dbo.Registration registration
                    JOIN dbo.[User] [user] ON registration.userId  = [user].id
                    WHERE 
                    registration.verifiedAt IS NOT NULL
                    AND [user].[isSystemAgent] = 0`;
                    const result2 = await db.$queryRawUnsafe(
                        queryNoOfRegistrations
                    );
                    noOfRegistrations = (result2 as any[])[0].noOfRegistrations;

                    const queryLast10Registrations = `SELECT
                    TOP 10
                    [date] = registration.verifiedAt
                    , registration.identifier
                    , domain = domain.name
                    , pubkey = [user].pubkey
                    FROM
                    dbo.Registration registration 
                    JOIN dbo.[User] [user] ON [user].id = registration.userId 
                    JOIN dbo.SystemDomain domain ON registration.systemDomainId = domain.id
                    WHERE 
                    registration.verifiedAt IS NOT NULL
                    AND [user].isSystemAgent = 0
                    ORDER BY registration.verifiedAt DESC`;
                    const result5 = await db.$queryRawUnsafe(
                        queryLast10Registrations
                    );
                    lastRegistrations =
                        result5 as RegistrationStatisticsOutput[];

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
                    registrationsPerDomain = (await db.$queryRawUnsafe(
                        queryRegistrationsPerDomain
                    )) as RegistrationsPerDomainStatisticsOutput[];

                    const durationInSeconds = (
                        (Date.now() - start) /
                        1000
                    ).toFixed(2);
                    this.emit(
                        "debug",
                        "info",
                        `${
                            this.#logPrefix
                        } getGlobalUserStats(): Fetching data finished in ${durationInSeconds} seconds`
                    );

                    // Write to Redis.
                    rGlobalUserStats = {
                        noOfUsers,
                        noOfRegistrations,
                        noOfRegistrationsPerDomain:
                            registrationsPerDomain.reduce((acc, x) => {
                                acc[x.domain] = x.registrations;
                                return acc;
                            }, {} as { [key: string]: number }),
                        lastRegistrations: lastRegistrations.map((x) => {
                            return {
                                date: x.date.toISOString(),
                                nip05: `${x.identifier}@${x.domain}`,
                            };
                        }),
                    };

                    await RMService.i.globalUserStats.save(rGlobalUserStats);
                });
                this.#lastGetGlobalUserStatsFromSqlDatabaseAt = Date.now();
            } else {
                const extrGlobalUserStats =
                    await RMService.i.globalUserStats.fetch();
                return extrGlobalUserStats?.data;
            }

            return rGlobalUserStats;
        } catch (error) {
            this.emit(
                "debug",
                "error",
                `${this.#logPrefix} getGlobalUserStats(): ${error}`
            );
            return undefined;
        }
    }
}

