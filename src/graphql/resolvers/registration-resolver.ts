import { DateTime } from "luxon";
import { Args, Authorized, Ctx, Mutation, Resolver } from "type-graphql";
import { HelperAuth } from "../../helpers/helper-auth";
import { HelperIdentifier } from "../../helpers/identifier";
import { Nostr } from "../../nostr/nostr";
import { SystemConfigId } from "../../prisma/assortments";
import { PrismaService } from "../../services/prisma-service";
import { RegistrationCodeCreateInput } from "../inputs/registration-code-create-input";
import { RegistrationCodeRedeemInput } from "../inputs/registration-code-redeem-input";
import { RegistrationCreateInput } from "../inputs/registration-create-input";
import { RegistrationOutput } from "../outputs/registration-output";
import { UserTokenOutput } from "../outputs/user-token-output";
import * as uuid from "uuid";
import { RegistrationRelayOutput } from "../outputs/registration-relay-output";
import {
    GraphqlContext,
    cleanAndAddUserFraudOption,
    getOrCreateUserInDatabaseAsync,
} from "../type-defs";
import { RegistrationDeleteInputArgs } from "../inputs/registration-delete-input";
import { Void } from "graphql-scalars/typings/typeDefs";
import { AzureServiceBus } from "../../services/azure-service-bus";
import { ServiceBusMessage } from "@azure/service-bus";
import { EnvService } from "../../services/env-service";
import { ErrorMessage } from "./error-messages";
import { AgentService } from "../../services/agent-service";

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
        @Args() args: RegistrationCodeCreateInput
    ): Promise<boolean> {
        await cleanupExpiredRegistrationsAsync();

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

        const fraudId = await cleanAndAddUserFraudOption(dbRegistration.userId);

        const content = `Your REGISTRATION code is:
            
${Array.from(dbRegistrationCode.code).join(" ")}

If you did not initiate this registration you can either ignore this message or click on the following link to report a fraud attempt:

https://nip05.social/report-fraud/${dbRegistration.userId}/${fraudId}

Your nip05.social Team`;

        const agentInfo =
            await AgentService.instance.determineAgentInfoForNextJobAsync(
                args.relay
            );

        const sbMessage: ServiceBusMessage = {
            body: {
                pubkey: dbRegistration.user.pubkey,
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

        return true;
    }

    @Mutation((returns) => RegistrationOutput)
    async createRegistration(
        @Args() args: RegistrationCreateInput
    ): Promise<RegistrationOutput> {
        await cleanupExpiredRegistrationsAsync();

        const now = DateTime.now();

        const dbUser = await getOrCreateUserInDatabaseAsync(args.npub);

        // Only continue, if the user was NOT reported as fraud.
        if (dbUser.fraudReportedAt != null) {
            throw new Error(ErrorMessage.fraud);
        }

        const check = await HelperIdentifier.canIdentifierBeRegisteredAsync(
            args.identifier
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
                    createdAt: new Date(),
                    validUntil: now
                        .plus({ minute: registrationValidityInMinutes })
                        .toJSDate(),
                    verifiedAt: null,
                },
            });

        return dbRegistration;
        // return dbAuthRegistration;
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
}

