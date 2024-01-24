import { DateTime } from "luxon";
import {
    Arg,
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
import { ErrorMessage } from "../error-messages";
import {
    NostrHelperV2,
    NostrPubkeyObject,
} from "../../../nostr/nostr-helper-2";
import { LoginNip07RedeemInputArgs } from "../../inputs/loginNip07RedeemInputArgs";
import { NostrEvent } from "../../../nostr/nostr";
import { LoginNip46CodeCreateInputArgs } from "../../inputs/loginNip46CodeCreateInputArgs";
import { LoginNip46RedeemInputArgs } from "../../inputs/loginNip46RedeemInputArgs";
import { Nip05NostrService } from "../../../services/nip05-nostr/nip05-nostr-service";

const cleanupExpiredLoginsAsync = async () => {
    const now = DateTime.now();

    await PrismaService.instance.db.userLoginCode.deleteMany({
        where: {
            validUntil: { lt: now.toJSDate() },
        },
    });
};

const cleanupExpiredLoginNip46Codes = async () => {
    const now = DateTime.now();

    await PrismaService.instance.db.userLoginNip46Code.deleteMany({
        where: {
            validUntil: { lt: now.toJSDate() },
        },
    });
};

@Resolver()
export class LoginResolver {
    @Mutation((returns) => String)
    async createLoginNip07Code(
        @Ctx() context: GraphqlContext,
        @Arg("pubkey") pubkey: string
    ): Promise<string> {
        const now = DateTime.now();

        let pubkeyObject: NostrPubkeyObject | undefined;
        try {
            pubkeyObject = NostrHelperV2.getNostrPubkeyObject(pubkey);
        } catch (error) {
            throw new Error(
                "Invalid pubkey. Please provide the pubkey either in npub or hex representation."
            );
        }

        if (!pubkeyObject.hex) {
            throw new Error(
                "Invalid pubkey. Please provide the pubkey either in npub or hex representation."
            );
        }

        const loginNip07CodeValidityInMinutes =
            await PrismaService.instance.getSystemConfigAsNumberAsync(
                SystemConfigId.LoginNip07CodeValidityInMinutes
            );
        if (!loginNip07CodeValidityInMinutes) {
            throw new Error(
                "System config not found in database. Please contact support."
            );
        }

        await cleanupExpiredLoginsAsync();

        const dbUser = await getOrCreateUserInDatabaseAsync(pubkeyObject.hex);

        const code = uuid.v4();

        const dbUserLoginNip07 = await context.db.userLoginCode.upsert({
            where: { userId: dbUser.id },
            update: {
                code,
                createdAt: now.toJSDate(),
                validUntil: now
                    .plus({ minute: loginNip07CodeValidityInMinutes })
                    .toJSDate(),
            },
            create: {
                userId: dbUser.id,
                code,
                createdAt: now.toJSDate(),
                validUntil: now
                    .plus({ minute: loginNip07CodeValidityInMinutes })
                    .toJSDate(),
            },
        });

        return code;
    }

    @Mutation((returns) => String)
    async createLoginNip46Code(
        @Ctx() context: GraphqlContext,
        @Args() args: LoginNip46CodeCreateInputArgs
    ): Promise<string> {
        const now = DateTime.now();

        // Make sure to remove outdated codes.
        await cleanupExpiredLoginNip46Codes();

        // Make sure to have both an npub and hex version of the pubkey.
        const pubkeyObject = NostrHelperV2.getNostrPubkeyObject(args.pubkey);

        // Create user in database if necessary.
        const dbUser = await getOrCreateUserInDatabaseAsync(pubkeyObject.hex);

        const code = uuid.v4();

        await context.db.userLoginNip46Code.upsert({
            where: {
                userId_deviceId: {
                    userId: dbUser.id,
                    deviceId: args.deviceId,
                },
            },
            update: {
                code,
                createdAt: now.toJSDate(),
                validUntil: now.plus({ minute: 4 }).toJSDate(),
            },
            create: {
                userId: dbUser.id,
                deviceId: args.deviceId,
                code,
                createdAt: now.toJSDate(),
                validUntil: now.plus({ minute: 4 }).toJSDate(),
            },
        });

        return code;
    }

    @Mutation((returns) => UserTokenOutput)
    async redeemLoginNip07Code(
        @Args() args: LoginNip07RedeemInputArgs,
        @Ctx() context: GraphqlContext
    ): Promise<UserTokenOutput> {
        await cleanupExpiredLoginsAsync();

        const dbUser = await context.db.user.findFirst({
            where: { pubkey: args.data.pubkey },
        });

        if (!dbUser) {
            throw new Error("No user found in the database with that pubkey.");
        }

        const dbUserLogin = await context.db.userLoginCode.findFirst({
            where: { userId: dbUser.id },
        });

        if (!dbUserLogin) {
            throw new Error(
                "No generated code found in the database. Invalid attempt."
            );
        }

        // Check 1: The content includes the server side generated code.
        if (!args.data.content.includes(dbUserLogin.code)) {
            throw new Error("The provided content is not valid.");
        }

        // Check 2: The provided event-signature is valid.
        if (!NostrHelperV2.verifySignature(args.data as NostrEvent)) {
            throw new Error("The signature is invalid.");
        }

        // Everything checks out. Finalize login.
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
                    userId: dbUser.id,
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
                userId: dbUser.id,
                deviceId: args.deviceId,
                token: uuid.v4(),
                validUntil: now
                    .plus({ minute: userTokenValidityInMinutes })
                    .toJSDate(),
            },
        });

        // Delete record in
        await context.db.userLoginCode.delete({
            where: { userId: dbUser.id },
        });

        return dbUserToken;
    }

    @Mutation((returns) => UserTokenOutput)
    async redeemLoginNip46Code(
        @Args() args: LoginNip46RedeemInputArgs,
        @Ctx() context: GraphqlContext
    ): Promise<UserTokenOutput> {
        await cleanupExpiredLoginNip46Codes();

        const dbUser = await context.db.user.findFirst({
            where: { pubkey: args.data.pubkey },
        });

        if (!dbUser) {
            throw new Error("No user found in the database with that pubkey.");
        }

        const dbUserLoginNip46Code =
            await context.db.userLoginNip46Code.findFirst({
                where: { userId: dbUser.id, deviceId: args.deviceId },
            });

        if (!dbUserLoginNip46Code) {
            throw new Error(
                "No generated code found in the database. Invalid attempt."
            );
        }

        // Check 1: The content includes the server side generated code.
        if (!args.data.content.includes(dbUserLoginNip46Code.code)) {
            throw new Error("The provided content is not valid.");
        }

        // Check 2: The provided event-signature is valid.
        if (!NostrHelperV2.verifySignature(args.data as NostrEvent)) {
            throw new Error("The signature is invalid.");
        }

        // Everything checks out. Finalize login.
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
                    userId: dbUser.id,
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
                userId: dbUser.id,
                deviceId: args.deviceId,
                token: uuid.v4(),
                validUntil: now
                    .plus({ minute: userTokenValidityInMinutes })
                    .toJSDate(),
            },
        });

        // Delete record in
        await context.db.userLoginNip46Code.delete({
            where: { id: dbUserLoginNip46Code.id },
        });

        return dbUserToken;
    }

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

        let pubkeyHex = NostrHelperV2.getNostrPubkeyObject(args.pubkey).hex;

        const dbUser = await getOrCreateUserInDatabaseAsync(pubkeyHex);
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
        await context.db.userLoginCode.upsert({
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

Click here to login automatically:

${url}/alogin/${dbUser.id}/${code}

If you did not initiate this login you can either ignore the message or click on the link below to report a fraud attempt:

https://nip05.social/report-fraud/${dbUser.id}/${fraudId}

Your "NIP05.social" Team`;

        // Determine the sending of the code
        // Option 1: Via the full set of defined SystemRelays
        // Option 2: Via one relay provided by the user

        let relays: string[] = [];
        if (!args.relay) {
            relays = await Nip05NostrService.instance.getRelevantAccountRelays(
                pubkeyHex
            );
        } else {
            relays.push(args.relay);
        }

        await Nip05NostrService.instance.sendDMFromBot(
            pubkeyHex,
            relays,
            content
        );

        return dbUser.id;
    }
}

