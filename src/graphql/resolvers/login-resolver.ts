import { DateTime } from "luxon";
import { Args, Ctx, Mutation, Resolver } from "type-graphql";
import { HelperAuth } from "../../helpers/helper-auth";
import { Nostr } from "../../nostr/nostr";
import { SystemConfigId } from "../../prisma/assortments";
import { PrismaService } from "../../services/prisma-service";
import { RelayService, SendCodeReason } from "../../services/relay-service";
import { LoginCodeCreateInputArgs } from "../inputs/login-code-create-input";
import { LoginCodeRedeemInput } from "../inputs/login-code-redeem-input";
import { UserTokenOutput } from "../outputs/user-token-output";
import { getOrCreateUserInDatabaseAsync, GraphqlContext } from "../type-defs";
import * as uuid from "uuid";

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
        });

        if (!dbUserLoginCode) {
            throw new Error("No login request found for this user.");
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

        const pubkey = Nostr.npubToHexObject(args.npub).hex;
        await RelayService.instance.sendCodeAsync(
            args.relay,
            pubkey,
            code,
            SendCodeReason.Login,
            dbUserLoginCode.id
        );

        return dbUser.id;
    }
}

