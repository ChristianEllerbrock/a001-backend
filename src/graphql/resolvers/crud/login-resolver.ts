import { DateTime } from "luxon";
import { Args, Ctx, Mutation, Resolver } from "type-graphql";
import { HelperAuth } from "../../../helpers/helper-auth";
import { SystemConfigId } from "../../../prisma/assortments";
import { PrismaService } from "../../../services/prisma-service";
import { LoginCodeCreateInputArgs } from "../../inputs/login-code-create-input";
import { LoginCodeRedeemInput } from "../../inputs/login-code-redeem-input";
import { UserTokenOutput } from "../../outputs/user-token-output";
import {
    cleanAndAddUserFraudOption,
    getOrCreateUserInDatabaseAsync,
    GraphqlContext,
} from "../../type-defs";
import * as uuid from "uuid";
import { AzureServiceBus } from "../../../services/azure-service-bus";
import { ServiceBusMessage } from "@azure/service-bus";
import { EnvService } from "../../../services/env-service";
import { ErrorMessage } from "../error-messages";
import { AgentService } from "../../../services/agent-service";
import {
    NostrHelperV2,
    NostrPubkeyObject,
} from "../../../nostr/nostr-helper-2";
import { JobType } from "../../../common/enums/job-type";
import { JobState } from "../../../common/enums/job-state";
import { ServiceBusDataDirectMessage } from "../../../common/data-types/service-bus-data-direct-message";

const cleanupExpiredLoginsAsync = async () => {
    const now = DateTime.now();

    await PrismaService.instance.db.userLoginCode.deleteMany({
        where: {
            validUntil: { lt: now.toJSDate() },
        },
    });
};

@Resolver()
export class LoginResolver {
    //
    // redeemLoginCode
    //
    @Mutation((returns) => UserTokenOutput)
    async redeemLoginCode(
        @Args() args: LoginCodeRedeemInput,
        @Ctx() context: GraphqlContext
    ): Promise<UserTokenOutput> {
        await cleanupExpiredLoginsAsync();

        const dbUserLoginCode = await context.db.userLoginCode.findFirst({
            where: { userId: args.userId },
            include: { user: true },
        });

        if (!dbUserLoginCode) {
            throw new Error("No login request found for this user.");
        }

        if (dbUserLoginCode.user.fraudReportedAt != null) {
            throw new Error(ErrorMessage.fraud);
        }

        if (dbUserLoginCode.code !== args.code) {
            throw new Error(
                "The provided code does not match the one we sent you."
            );
        }

        // Code matches. Finalize login.
        const now = DateTime.now();
        const userTokenValidityInMinutes =
            await PrismaService.instance.getSystemConfigAsNumberAsync(
                SystemConfigId.UserTokenValidityInMinutes
            );

        if (!userTokenValidityInMinutes) {
            throw new Error("Invalid system config. Please contact support.");
        }

        // Create or update user token.

        const dbUserToken = await context.db.userToken.upsert({
            where: {
                userId_deviceId: {
                    userId: dbUserLoginCode.userId,
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
                userId: dbUserLoginCode.userId,
                deviceId: args.deviceId,
                token: uuid.v4(),
                validUntil: now
                    .plus({ minute: userTokenValidityInMinutes })
                    .toJSDate(),
            },
        });

        // Delete record in UserLoginCode
        await context.db.userLoginCode.delete({
            where: { userId: dbUserToken.userId },
        });

        return dbUserToken;
    }

    //
    // createLoginCode
    //
    @Mutation((returns) => String)
    async createLoginCode(
        @Ctx() context: GraphqlContext,
        @Args() args: LoginCodeCreateInputArgs
    ): Promise<string> {
        await cleanupExpiredLoginsAsync();

        let cleanedRelay = args.relay;
        if (args.relay.startsWith("wss://wss://")) {
            cleanedRelay = args.relay.slice(6);
        }

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

        // CHeck, if the user was reported as "fraud"
        if (dbUser.fraudReportedAt != null) {
            throw new Error(ErrorMessage.fraud);
        }

        const loginValidityInMinutes =
            await PrismaService.instance.getSystemConfigAsNumberAsync(
                SystemConfigId.LoginCodeValidityInMinutes
            );
        if (!loginValidityInMinutes) {
            throw new Error(
                "System config not found in database. Please contact support."
            );
        }

        const code = HelperAuth.generateCode();

        const dbUserLoginCode = await context.db.userLoginCode.upsert({
            where: { userId: dbUser.id },
            update: {
                code,
                createdAt: now.toJSDate(),
                validUntil: now
                    .plus({ minute: loginValidityInMinutes })
                    .toJSDate(),
            },
            create: {
                userId: dbUser.id,
                code,
                createdAt: now.toJSDate(),
                validUntil: now
                    .plus({ minute: loginValidityInMinutes })
                    .toJSDate(),
            },
        });

        // Create JOB
        const dbJob = await context.db.job.create({
            data: {
                userId: dbUser.id,
                // createdAt: new Date()
                jobTypeId: JobType.NostrDirectMessage,
                jobStateId: JobState.Created,
            },
        });

        // Create MESSAGE to send to the queue
        const url = context.req.hostname.includes("localhost")
            ? "https://dev.app.nip05.social"
            : context.req.protocol + "://" + context.req.hostname;

        const fraudId = await cleanAndAddUserFraudOption(dbUser.id);
        const content = `Your LOGIN code is:

${Array.from(code).join(" ")}

Click [here](${url}/alogin/${dbUser.id}/${code}) to automatically login.

If you did not initiate this login you can either ignore this message or click on this [link](https://nip05.social/report-fraud/${
            dbUser.id
        }/${fraudId}) to report a fraud attempt.

Your nip05.social Team`;

        const agentInfo =
            await AgentService.instance.determineAgentInfoForNextJobAsync(
                cleanedRelay
            );

        const data: ServiceBusDataDirectMessage = {
            pubkey: pubkeyObject.hex,
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

        return dbUser.id;
    }
}

