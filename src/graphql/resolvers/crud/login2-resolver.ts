import { Args, Ctx, Mutation, Resolver } from "type-graphql";
import {
    GraphqlContext,
    getOrCreateUserInDatabaseAsync,
} from "../../type-defs";
import { DateTime } from "luxon";
import { PrismaClient, UserToken } from "@prisma/client";
import { HelperAuth } from "../../../helpers/helper-auth";
import { NostrHelperV2 } from "../../../nostr/nostr-helper-2";
import { LoginViaDmInput } from "../../inputs/v2/login-via-dm-input";
import { Nip05NostrService } from "../../../services/nip05-nostr/nip05-nostr-service";
import { EnvService } from "../../../services/env-service";
import { LoginViaDmOutput } from "../../outputs/login-via-dm-output";
import { UserTokenOutput } from "../../outputs/user-token-output";
import { v4 } from "uuid";
import { LoginViaDmRedeemInput } from "../../inputs/v2/login-via-dm-redeem-input";
import { LoginViaExtensionInput } from "../../inputs/v2/login-via-extension-input";
import { LoginViaExtensionRedeemInput } from "../../inputs/v2/login-via-extension-redeem-input";
import { Event, verifyEvent } from "nostr-tools";

const deleteExpiredLoginsAsync = async (db: PrismaClient) => {
    const now = new Date();

    await db.userLoginCode.deleteMany({
        where: {
            validUntil: { lt: now },
        },
    });
};

const deleteExpiredNip07LoginsAsync = async (db: PrismaClient) => {
    const now = new Date();

    await db.userLoginNip07Code.deleteMany({
        where: {
            validUntil: { lt: now },
        },
    });
};

@Resolver()
export class Login2Resolver {
    @Mutation(() => LoginViaDmOutput)
    async loginViaDm(
        @Ctx() context: GraphqlContext,
        @Args() args: LoginViaDmInput
    ): Promise<LoginViaDmOutput> {
        const now = DateTime.now();
        const loginValidityInMinutes = 15;

        const pubkey = NostrHelperV2.getNostrPubkeyObject(args.pubkey).hex;

        // Create a new login code.
        const code = HelperAuth.generateCode();

        // Delete expired login codes in the SQL database.
        await deleteExpiredLoginsAsync(context.db);

        // Get or create the user in the SQL database.
        const [sqlUser, registrationRelays] =
            await getOrCreateUserInDatabaseAsync(pubkey);

        await context.db.userLoginCode.upsert({
            where: { userId: sqlUser.id },
            update: {
                code,
                createdAt: now.toJSDate(),
                validUntil: now
                    .plus({ minute: loginValidityInMinutes })
                    .toJSDate(),
            },
            create: {
                userId: sqlUser.id,
                code,
                createdAt: now.toJSDate(),
                validUntil: now
                    .plus({ minute: loginValidityInMinutes })
                    .toJSDate(),
            },
        });

        // Prepare the DM content to be sent:
        const content = `Your LOGIN code is:

${Array.from(code).join(" ")}
        
Click the link below to log in automatically:
        
https://app.nip05.social/alogin/${sqlUser.id}/${code}
`;

        const relevantRelays = Array.from(
            new Set<string>([
                ...registrationRelays,
                ...args.relays,
                EnvService.instance.env.RELAY_URL,
            ])
        );

        const nip65IncludedRelevantRelays =
            await Nip05NostrService.instance.includeNip65Relays(
                pubkey,
                relevantRelays
            );

        // Call the ASYNC function synchronously to send the DM
        // after the method here has returned.
        Nip05NostrService.instance.sendDMFromBot(
            pubkey,
            nip65IncludedRelevantRelays,
            content
        );

        return {
            userId: sqlUser.id,
            relays: nip65IncludedRelevantRelays,
        };
    }

    @Mutation(() => String)
    async loginViaExtension(
        @Ctx() context: GraphqlContext,
        @Args() args: LoginViaExtensionInput
    ): Promise<string> {
        const now = DateTime.now();
        const loginValidityInMinutes = 15;
        const pubkey = NostrHelperV2.getNostrPubkeyObject(args.pubkey).hex;

        // Create a new login code.
        const code = v4();

        // Delete expired login codes in the SQL database.
        await deleteExpiredNip07LoginsAsync(context.db);

        // Get or create the user in the SQL database.
        const [sqlUser, registrationRelays] =
            await getOrCreateUserInDatabaseAsync(pubkey);

        await context.db.userLoginNip07Code.upsert({
            where: {
                userId_deviceId: {
                    userId: sqlUser.id,
                    deviceId: args.deviceId,
                },
            },
            update: {
                code,
                createdAt: now.toJSDate(),
                validUntil: now
                    .plus({ minute: loginValidityInMinutes })
                    .toJSDate(),
            },
            create: {
                userId: sqlUser.id,
                deviceId: args.deviceId,
                code,
                createdAt: now.toJSDate(),
                validUntil: now
                    .plus({ minute: loginValidityInMinutes })
                    .toJSDate(),
            },
        });

        return code;
    }

    @Mutation(() => UserTokenOutput)
    async loginViaExtensionRedeem(
        @Args() args: LoginViaExtensionRedeemInput,
        @Ctx() context: GraphqlContext
    ) {
        const now = DateTime.now();
        const userTokenValidityInMinutes = 1440;
        await deleteExpiredNip07LoginsAsync(context.db);

        const result = await context.db.$transaction(
            // Check 2: The provided event-signature is valid.

            async (db): Promise<UserToken> => {
                // Check: The provided event-signature is valid.
                if (!verifyEvent(args.data as Event)) {
                    throw new Error("The signature is invalid.");
                }

                const sqlUser = await db.user.findFirst({
                    where: { pubkey: args.data.pubkey },
                });

                if (!sqlUser) {
                    throw new Error(
                        "No user found in the database with that pubkey."
                    );
                }

                const sqlUserLogin = await db.userLoginNip07Code.findUnique({
                    where: {
                        userId_deviceId: {
                            userId: sqlUser.id,
                            deviceId: args.deviceId,
                        },
                    },
                });

                if (!sqlUserLogin) {
                    throw new Error(
                        "No generated code found in the database. Invalid attempt."
                    );
                }

                // Check: The content includes the server side generated code.
                if (!args.data.content.includes(sqlUserLogin.code)) {
                    throw new Error("The provided content is not valid.");
                }

                // Everything checks out. Finalize login.
                // Create or update user token.

                const sqlUserToken = await db.userToken.upsert({
                    where: {
                        userId_deviceId: {
                            userId: sqlUser.id,
                            deviceId: args.deviceId,
                        },
                    },
                    update: {
                        token: v4(),
                        validUntil: now
                            .plus({ minute: userTokenValidityInMinutes })
                            .toJSDate(),
                    },
                    create: {
                        userId: sqlUser.id,
                        deviceId: args.deviceId,
                        token: v4(),
                        validUntil: now
                            .plus({ minute: userTokenValidityInMinutes })
                            .toJSDate(),
                    },
                });

                // Delete record in
                await db.userLoginNip07Code.delete({
                    where: {
                        userId_deviceId: {
                            userId: sqlUserToken.userId,
                            deviceId: args.deviceId,
                        },
                    },
                });

                return sqlUserToken;
            }
        );

        return result;
    }

    @Mutation(() => UserTokenOutput)
    async loginViaDmRedeem(
        @Args() args: LoginViaDmRedeemInput,
        @Ctx() context: GraphqlContext
    ) {
        const userTokenValidityInMinutes = 1440;
        await deleteExpiredLoginsAsync(context.db);

        const result = await context.db.$transaction(
            async (db): Promise<UserToken> => {
                const dbUserLoginCode = await db.userLoginCode.findFirst({
                    where: { userId: args.userId },
                    include: { user: true },
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

                // Create or update user token.

                const dbUserToken = await db.userToken.upsert({
                    where: {
                        userId_deviceId: {
                            userId: dbUserLoginCode.userId,
                            deviceId: args.deviceId,
                        },
                    },
                    update: {
                        token: v4(),
                        validUntil: now
                            .plus({ minute: userTokenValidityInMinutes })
                            .toJSDate(),
                    },
                    create: {
                        userId: dbUserLoginCode.userId,
                        deviceId: args.deviceId,
                        token: v4(),
                        validUntil: now
                            .plus({ minute: userTokenValidityInMinutes })
                            .toJSDate(),
                    },
                });

                // Delete record in UserLoginCode
                await db.userLoginCode.delete({
                    where: { userId: dbUserToken.userId },
                });

                return dbUserToken;
            }
        );

        return result;
    }
}

