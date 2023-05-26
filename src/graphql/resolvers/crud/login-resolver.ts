import { DateTime } from "luxon";
import {
    Args,
    Ctx,
    Mutation,
    PubSub,
    PubSubEngine,
    Resolver,
} from "type-graphql";
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
import { JobStateChangePayload } from "../../payloads/job-state-change-payload";
import { PUBLISH_TOPICS } from "../subscriptions/topics";
import { AgentRelayer } from "../../../nostr/agents/agent-relayer";
import { AgentRelayerService } from "../../../nostr/agents/agent-relayer-service";

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
        @Args() args: LoginCodeCreateInputArgs,
        @PubSub() pubSub: PubSubEngine
    ): Promise<string> {
        const now = DateTime.now();

        await cleanupExpiredLoginsAsync();

        let pubkeyObject: NostrPubkeyObject | undefined;
        try {
            pubkeyObject = NostrHelperV2.getNostrPubkeyObject(args.pubkey);
        } catch (error) {
            throw new Error(
                "Invalid pubkey. Please provide the pubkey either in npub or hex representation."
            );
        }

        const dbUser = await getOrCreateUserInDatabaseAsync(pubkeyObject.hex);
        // Check, if the user was reported as "fraud"
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

        let url = "";
        if (context.req.hostname.includes("localhost")) {
            url = "https://dev.app.nip05.social";
        } else if (context.req.hostname.includes("dev")) {
            url = "https://dev.app.nip05.social";
        } else {
            url = "https://app.nip05.social";
        }

        const fraudId = await cleanAndAddUserFraudOption(dbUser.id);
        const content = `Your LOGIN code is:

${Array.from(code).join(" ")}

Click [here](${url}/alogin/${dbUser.id}/${code}) to automatically login.

If you did not initiate this login you can either ignore this message or click on this [link](https://nip05.social/report-fraud/${
            dbUser.id
        }/${fraudId}) to report a fraud attempt.

Your nip05.social Team`;

        // Determine the sending of the code
        // Option 1: Via the full set of defined SystemRelays
        // Option 2: Via one relay provided by the user
        enum Option {
            WithSystemRelayer = 1,
            WithCustomRelayer = 3,
        }
        const option: Option =
            typeof args.relay === "undefined"
                ? Option.WithSystemRelayer
                : Option.WithCustomRelayer;

        let ar: AgentRelayer | undefined;
        if (option === Option.WithCustomRelayer) {
            ar = await AgentRelayerService.instance.initWithCustomRelayer([
                args.relay ?? "",
            ]);
        } else {
            await AgentRelayerService.instance.init();
            ar = AgentRelayerService.instance.getAgentRelayer();
        }

        const noOfRelays = ar?.relayClients.length ?? 0;
        let relayResponses = 0;

        const subscription = ar?.sendEvent.subscribe((event) => {
            console.log(event);
            if (event.jobId !== args.jobId) {
                return; // from some other process
            }
            relayResponses++;
            if (relayResponses === noOfRelays) {
                console.log("END");
                subscription?.unsubscribe();
            }

            const payload: JobStateChangePayload = {
                relay: event.relay,
                success: event.success,
                item: relayResponses,
                ofItems: noOfRelays,
                destinationFilter: {
                    jobId: args.jobId,
                    pubkey: args.pubkey,
                },
            };
            pubSub.publish(PUBLISH_TOPICS.JOB_STATE_CHANGE, payload);
        });

        if (option === Option.WithCustomRelayer) {
            if (typeof ar === "undefined") {
                throw new Error(
                    "Internal server error. Could not initialize agent relayer."
                );
            }
            await AgentRelayerService.instance.sendWithCustomRelayer(
                pubkeyObject.hex,
                content,
                args.jobId,
                ar
            );
        } else {
            // Send with system relayer
            await AgentRelayerService.instance.send(
                pubkeyObject.hex,
                content,
                args.jobId
            );
        }

        return dbUser.id;

        // Create JOB
        // const dbJob = await context.db.job.create({
        //     data: {
        //         userId: dbUser.id,
        //         // createdAt: new Date()
        //         jobTypeId: JobType.NostrDirectMessage,
        //         jobStateId: JobState.Created,
        //     },
        // });

        // Create MESSAGE to send to the queue

        // const agentInfo =
        //     await AgentService.instance.determineAgentInfoForNextJobAsync(
        //         cleanedRelay
        //     );

        // const data: ServiceBusDataDirectMessage = {
        //     pubkey: pubkeyObject.hex,
        //     content,
        //     relay: cleanedRelay,
        //     agentPubkey: agentInfo[0],
        //     jobId: dbJob.id,
        // };

        // const sbMessage: ServiceBusMessage = {
        //     body: data,
        // };
        // await AzureServiceBus.instance.sendAsync(
        //     sbMessage,
        //     EnvService.instance.env.SERVICE_BUS_DM_QUEUE,
        //     agentInfo[1]
        // );

        return dbUser.id;
    }
}

