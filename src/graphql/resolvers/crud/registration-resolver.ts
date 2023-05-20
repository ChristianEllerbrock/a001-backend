import { DateTime } from "luxon";
import {
    Arg,
    Args,
    Authorized,
    Ctx,
    Mutation,
    Query,
    Resolver,
} from "type-graphql";
import { HelperAuth } from "../../../helpers/helper-auth";
import { HelperIdentifier } from "../../../helpers/identifier";
import { SystemConfigId } from "../../../prisma/assortments";
import { PrismaService } from "../../../services/prisma-service";
import { RegistrationCodeCreateInput } from "../../inputs/registration-code-create-input";
import { RegistrationCodeRedeemInput } from "../../inputs/registration-code-redeem-input";
import { RegistrationCreateInput } from "../../inputs/registration-create-input";
import { RegistrationOutput } from "../../outputs/registration-output";
import { UserTokenOutput } from "../../outputs/user-token-output";
import * as uuid from "uuid";
import {
    GraphqlContext,
    cleanAndAddUserFraudOption,
    getOrCreateUserInDatabaseAsync,
} from "../../type-defs";
import { RegistrationDeleteInputArgs } from "../../inputs/registration-delete-input";
import { AzureServiceBus } from "../../../services/azure-service-bus";
import { ServiceBusMessage } from "@azure/service-bus";
import { EnvService } from "../../../services/env-service";
import { ErrorMessage } from "../error-messages";
import { AgentService } from "../../../services/agent-service";
import {
    NostrHelperV2,
    NostrPubkeyObject,
} from "../../../nostr/nostr-helper-2";
import { RegistrationInputUpdateArgs } from "../../inputs/updates/registration-input-update";
import { HelperRegex } from "../../../helpers/helper-regex";
import { NostrAddressStatisticsOutput } from "../../outputs/statistics/nostr-address-statistics-output";
import { JobType } from "../../../common/enums/job-type";
import { JobState } from "../../../common/enums/job-state";
import { ServiceBusDataDirectMessage } from "../../../common/data-types/service-bus-data-direct-message";

const NOSTR_STATISTICS = "nostrStatistics";

const cleanupExpiredRegistrationsAsync = async () => {
    const now = DateTime.now();

    await PrismaService.instance.db.registration.deleteMany({
        where: {
            verifiedAt: null,
            validUntil: { lt: now.toJSDate() },
        },
    });
};

@Resolver()
export class RegistrationResolver {
    @Mutation((returns) => UserTokenOutput)
    async redeemRegistrationCode(
        @Args() args: RegistrationCodeRedeemInput
    ): Promise<UserTokenOutput> {
        await cleanupExpiredRegistrationsAsync();

        const dbRegistration =
            await PrismaService.instance.db.registration.findFirst({
                where: { id: args.registrationId, userId: args.userId },
                include: { registrationCode: true },
            });

        if (!dbRegistration) {
            throw new Error(
                "No registration found matching the provided data."
            );
        }

        if (dbRegistration.registrationCode?.code !== args.code) {
            throw new Error("The provided code does not match.");
        }

        // Code matches. Finalize registration.
        const now = DateTime.now();
        await PrismaService.instance.db.registration.update({
            where: { id: dbRegistration.id },
            data: {
                verifiedAt: now.toJSDate(),
            },
        });

        await PrismaService.instance.db.registrationCode.delete({
            where: { id: dbRegistration.registrationCode.id },
        });

        const userTokenValidityInMinutes =
            await PrismaService.instance.getSystemConfigAsNumberAsync(
                SystemConfigId.UserTokenValidityInMinutes
            );

        if (!userTokenValidityInMinutes) {
            throw new Error("Invalid system config. Please contact support.");
        }

        // Create or update user token.
        const dbUserToken = await PrismaService.instance.db.userToken.upsert({
            where: {
                userId_deviceId: {
                    userId: dbRegistration.userId,
                    deviceId: args.deviceId,
                },
            },
            update: {
                token: uuid.v4(),
                validUntil: now
                    .plus({ minute: userTokenValidityInMinutes })
                    .toJSDate(),
            },
            create: {
                userId: dbRegistration.userId,
                deviceId: args.deviceId,
                token: uuid.v4(),
                validUntil: now
                    .plus({ minute: userTokenValidityInMinutes })
                    .toJSDate(),
            },
        });

        return dbUserToken;
    }

    @Mutation((returns) => Boolean)
    async createRegistrationCode(
        @Ctx() context: GraphqlContext,
        @Args() args: RegistrationCodeCreateInput
    ): Promise<boolean> {
        await cleanupExpiredRegistrationsAsync();

        let cleanedRelay = args.relay;
        if (args.relay.startsWith("wss://wss://")) {
            cleanedRelay = args.relay.slice(6);
        }

        const now = DateTime.now();

        const registrationCodeValidityInMinutes =
            await PrismaService.instance.getSystemConfigAsNumberAsync(
                SystemConfigId.RegistrationCodeValidityInMinutes
            );

        if (!registrationCodeValidityInMinutes) {
            throw new Error("Invalid system config. Please contact support.");
        }

        const dbRegistration =
            await PrismaService.instance.db.registration.findFirst({
                where: { id: args.registrationId, userId: args.userId },
                include: { registrationCode: true, user: true },
            });

        if (!dbRegistration) {
            throw new Error("No registration found with these parameters.");
        }

        if (dbRegistration.verifiedAt) {
            throw new Error("The registration is already verified.");
        }

        // Delete old code if one is available
        if (dbRegistration.registrationCode) {
            await PrismaService.instance.db.registrationCode.delete({
                where: { id: dbRegistration.registrationCode.id },
            });
        }

        // Create new code
        const dbRegistrationCode =
            await PrismaService.instance.db.registrationCode.create({
                data: {
                    registrationId: args.registrationId,
                    createdAt: now.toJSDate(),
                    validUntil: now
                        .plus({ minute: registrationCodeValidityInMinutes })
                        .toJSDate(),
                    code: HelperAuth.generateCode(),
                },
            });

        // Create JOB
        const dbJob = await context.db.job.create({
            data: {
                userId: dbRegistration.userId,
                jobTypeId: JobType.NostrDirectMessage,
                jobStateId: JobState.Created,
            },
        });

        let aUrl = "";
        if (context.req.hostname.includes("localhost")) {
            aUrl = "https://dev.app.nip05.social";
        } else if (context.req.hostname.includes("dev")) {
            aUrl = "https://dev.app.nip05.social";
        } else {
            aUrl = "https://app.nip05.social";
        }

        const fraudId = await cleanAndAddUserFraudOption(dbRegistration.userId);
        const content = `Your REGISTRATION code is:
            
${Array.from(dbRegistrationCode.code).join(" ")}

Click [here](${aUrl}/aregister/${dbRegistration.userId}/${dbRegistration.id}/${
            dbRegistrationCode.code
        }) to finalize your registration.

If you did not initiate this registration you can either ignore this message or click on this [link](https://nip05.social/report-fraud/${
            dbRegistration.userId
        }/${fraudId}) to report a fraud attempt.

Your nip05.social Team`;

        const agentInfo =
            await AgentService.instance.determineAgentInfoForNextJobAsync(
                cleanedRelay
            );

        const data: ServiceBusDataDirectMessage = {
            pubkey: dbRegistration.user.pubkey,
            content,
            relay: cleanedRelay,
            agentPubkey: agentInfo[0],
            jobId: dbJob.id,
        };

        const sbMessage: ServiceBusMessage = {
            body: data,
        };

        await AzureServiceBus.instance.sendAsync(
            sbMessage,
            EnvService.instance.env.SERVICE_BUS_DM_QUEUE,
            agentInfo[1]
        );

        return true;
    }

    @Mutation((returns) => RegistrationOutput)
    async createRegistration(
        @Args() args: RegistrationCreateInput
    ): Promise<RegistrationOutput> {
        await cleanupExpiredRegistrationsAsync();

        const now = DateTime.now();

        let pubkeyObject: NostrPubkeyObject | undefined;
        try {
            pubkeyObject = NostrHelperV2.getNostrPubkeyObject(args.pubkey);
        } catch (error) {
            throw new Error(
                "Invalid pubkey. Please provide the pubkey either in npub or hex representation."
            );
        }

        const dbUser = await getOrCreateUserInDatabaseAsync(pubkeyObject.hex);

        // Only continue, if the user was NOT reported as fraud.
        if (dbUser.fraudReportedAt != null) {
            throw new Error(ErrorMessage.fraud);
        }

        const check = await HelperIdentifier.canIdentifierBeRegisteredAsync(
            args.identifier,
            args.systemDomainId
        );

        if (!check.canBeRegistered) {
            throw new Error(check.reason);
        }

        const registrationValidityInMinutes =
            await PrismaService.instance.getSystemConfigAsNumberAsync(
                SystemConfigId.RegistrationValidityInMinutes
            );
        if (!registrationValidityInMinutes) {
            throw new Error(
                "System config not found in database. Please contact support."
            );
        }

        // Create registration in database
        const dbRegistration =
            await PrismaService.instance.db.registration.create({
                data: {
                    userId: dbUser.id,
                    identifier: check.name,
                    systemDomainId: args.systemDomainId,
                    createdAt: new Date(),
                    validUntil: now
                        .plus({ minute: registrationValidityInMinutes })
                        .toJSDate(),
                    verifiedAt: null,
                    lightningAddress: null,
                },
            });

        return dbRegistration;
    }

    @Authorized()
    @Mutation((returns) => String)
    async deleteRegistration(
        @Ctx() context: GraphqlContext,
        @Args() args: RegistrationDeleteInputArgs
    ): Promise<string> {
        const dbRegistration = await context.db.registration.findUnique({
            where: { id: args.registrationId },
        });

        if (
            !dbRegistration ||
            dbRegistration?.userId !== context.user?.userId
        ) {
            throw new Error(
                `Could not find your registration with id '${args.registrationId}'.`
            );
        }

        await context.db.registration.delete({
            where: { id: dbRegistration.id },
        });
        return dbRegistration.id;
    }

    @Authorized()
    @Mutation((returns) => RegistrationOutput)
    async updateRegistration(
        @Ctx() context: GraphqlContext,
        @Args() args: RegistrationInputUpdateArgs
    ): Promise<RegistrationOutput> {
        const dbRegistration = await context.db.registration.findUnique({
            where: { id: args.registrationId },
        });

        if (!dbRegistration || dbRegistration.userId !== context.user?.userId) {
            throw new Error("Could not find registration or unauthorized.");
        }

        const cleanedLightningAddress =
            args.data.lightningAddress?.trim().toLowerCase() ?? null;

        if (
            cleanedLightningAddress &&
            !HelperRegex.isValidLightningAddress(cleanedLightningAddress)
        ) {
            throw new Error("Invlid lightning address.");
        }

        const updatedDbRegistration = await context.db.registration.update({
            where: { id: args.registrationId },
            data: {
                lightningAddress: cleanedLightningAddress,
            },
        });

        return updatedDbRegistration;
    }

    @Authorized()
    @Query((returns) => NostrAddressStatisticsOutput)
    async nostrAddressStatistics(
        @Ctx() context: GraphqlContext,
        @Arg("registrationId") registrationId: string
    ): Promise<NostrAddressStatisticsOutput> {
        const dbRegistration = await context.db.registration.findUnique({
            where: { id: registrationId },
        });

        if (!dbRegistration || dbRegistration.userId !== context.user?.userId) {
            throw new Error("Could not find registration or unauthorized.");
        }

        const now = DateTime.now();
        const nowString = now.toJSDate().toISOString().slice(0, 10);
        const yesterday = now.plus({ days: -1 });
        const yesterdayString = yesterday.toJSDate().toISOString().slice(0, 10);

        const noOfLookups = dbRegistration.nipped;

        const query = `SELECT
            noOfLookupsYesterday = ISNULL(SUM(IIF(registrationLookup.[date] = '${yesterdayString}',
                registrationLookup.total,
                0
            )), 0)
            , noOfLookupsToday = ISNULL(SUM(IIF(registrationLookup.[date] = '${nowString}',
                registrationLookup.total,
                0
            )), 0)
            FROM
            dbo.RegistrationLookup registrationLookup
            JOIN dbo.Registration registration ON registrationLookup.registrationId = registration.id
            JOIN dbo.[User] [user] ON [user].id = registration.userId 
            WHERE 
            registration.id = '${dbRegistration.id}'
            AND registrationLookup.[date] in (
                (SELECT CONVERT (Date, GETDATE()) AS [Current Date]),
                (SELECT CONVERT (Date, DATEADD(DAY, -1, GETDATE()) ) AS [Current Date])
            )
            AND [user].isSystemAgent = 0`;
        const result3 = await context.db.$queryRawUnsafe(query);
        const noOfLookupsYesterday = (result3 as any[])[0].noOfLookupsYesterday;
        const noOfLookupsToday = (result3 as any[])[0].noOfLookupsToday;

        const stats: NostrAddressStatisticsOutput = {
            id: registrationId,
            noOfLookups,
            noOfLookupsToday,
            noOfLookupsYesterday,
        };

        return stats;
    }
}

