import { DateTime } from "luxon";
import { Args, Ctx, Mutation, Resolver } from "type-graphql";
import { HelperAuth } from "../../helpers/helper-auth";
import { Nostr } from "../../nostr/nostr";
import { SystemConfigId } from "../../prisma/assortments";
import { PrismaService } from "../../services/prisma-service";
import { LoginCodeCreateInputArgs } from "../inputs/login-code-create-input";
import { LoginCodeRedeemInput } from "../inputs/login-code-redeem-input";
import { UserTokenOutput } from "../outputs/user-token-output";
import {
    cleanAndAddUserFraudOption,
    getOrCreateUserInDatabaseAsync,
    GraphqlContext,
} from "../type-defs";
import * as uuid from "uuid";
import { AzureServiceBus } from "../../services/azure-service-bus";
import { ServiceBusMessage } from "@azure/service-bus";
import { EnvService } from "../../services/env-service";
import { ErrorMessage } from "./error-messages";
import { AgentService } from "../../services/agent-service";

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

    @Mutation((returns) => String)
    async createLoginCode(
        @Ctx() context: GraphqlContext,
        @Args() args: LoginCodeCreateInputArgs
    ): Promise<string> {
        await cleanupExpiredLoginsAsync();

        const now = DateTime.now();

        const dbUser = await getOrCreateUserInDatabaseAsync(args.npub);

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

        const fraudId = await cleanAndAddUserFraudOption(dbUser.id);

        const pubkey = Nostr.npubToHexObject(args.npub).hex;

        const content = `Your LOGIN code is:

${Array.from(code).join(" ")}

If you did not initiate this login you can either ignore this message or click on the following link to report a fraud attempt:

https://nip05.social/report-fraud/${dbUser.id}/${fraudId}

Your nip05.social Team`;

        const agentInfo =
            await AgentService.instance.determineAgentInfoForNextJobAsync(
                args.relay
            );

        const sbMessage: ServiceBusMessage = {
            body: {
                pubkey,
                content,
                relay: args.relay,
                agentPubkey: agentInfo[0],
            },
        };
        await AzureServiceBus.instance.sendAsync(
            sbMessage,
            EnvService.instance.env.SERVICE_BUS_DM_QUEUE,
            agentInfo[1]
        );

        return dbUser.id;
    }
}

