import { DateTime } from "luxon";
import {
    Arg,
    Args,
    Authorized,
    Ctx,
    Int,
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
import { RegistrationOutput } from "../../outputs/registration-output";
import { UserTokenOutput } from "../../outputs/user-token-output";
import * as uuid from "uuid";
import {
    GraphqlContext,
    cleanAndAddUserFraudOption,
    getOrCreateUserInDatabaseAsync,
} from "../../type-defs";
import { RegistrationDeleteInputArgs } from "../../inputs/registration-delete-input";
import { ErrorMessage } from "../error-messages";
import { NostrHelperV2 } from "../../../nostr/nostr-helper-2";
import { RegistrationInputUpdateArgs } from "../../inputs/updates/registration-input-update";
import { HelperRegex } from "../../../helpers/helper-regex";
import { NostrAddressStatisticsOutput } from "../../outputs/statistics/nostr-address-statistics-output";
import { IdentifierRegisterCheckOutput } from "../../outputs/identifier-register-check-output";
import { RegistrationCodeResendInput } from "../../inputs/registration-code-resend-input";
import { CreateRegistrationNip07CodeOutput } from "../../outputs/createRegistrationNip07CodeOutput";
import { RegistrationNip07RedeemInputArgs } from "../../inputs/registrationNip07RedeemInputArgs";
import { CreateRegistrationNip46CodeOutput } from "../../outputs/createRegistrationNip46CodeOutput";
import { RegistrationNip46RedeemInputArgs } from "../../inputs/registrationNip46RedeemInputArgs";
import { Nip05NostrService } from "../../../services/nip05-nostr/nip05-nostr-service";
import { NostrPubkeyObject } from "../../../nostr/type-defs";
import { verifyEvent } from "nostr-tools";
import { RedisMemoryService } from "../../../services/redis-memory-service";
import { NonCollectionRedisTypes } from "../../../types/redis/@types";

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
    // #region Queries

    // @Authorized() // IMPORTANT: MUST NOT HAVE @Authorized attribute
    @Query((returns) => [RegistrationOutput], { nullable: true })
    async myRegistrations(
        @Ctx() context: GraphqlContext
    ): Promise<RegistrationOutput[] | null> {
        if (!context.user) {
            return null;
        }

        const isAuthenticated = await context.user.hasValidTokenAsync();

        if (!isAuthenticated) {
            return null;
        }

        const dbRegistrations = await context.db.registration.findMany({
            where: {
                userId: context.user.userId,
                verifiedAt: {
                    not: null,
                },
            },
            include: {
                systemDomain: true,
            },
        });

        return dbRegistrations.sortBy(
            (x) => x.systemDomain.name + x.identifier
        );
    }

    @Query((returns) => IdentifierRegisterCheckOutput)
    async isRegistrationAvailable(
        @Ctx() context: GraphqlContext,
        @Arg("name") name: string,
        @Arg("systemDomainId", (type) => Int) systemDomainId: number
    ): Promise<IdentifierRegisterCheckOutput> {
        return await HelperIdentifier.canIdentifierBeRegisteredAsync(
            name.trim().toLowerCase(),
            systemDomainId
        );
    }

    @Authorized()
    @Query((returns) => NostrAddressStatisticsOutput)
    async nostrAddressStatistics(
        @Ctx() context: GraphqlContext,
        @Arg("registrationId") registrationId: string
    ): Promise<NostrAddressStatisticsOutput> {
        const dbRegistration = await context.db.registration.findUnique({
            where: { id: registrationId },
            include: {
                systemDomain: true,
            },
        });

        if (!dbRegistration || dbRegistration.userId !== context.user?.userId) {
            throw new Error("Could not find registration or unauthorized.");
        }

        const fullIdentifier =
            dbRegistration.identifier + "@" + dbRegistration.systemDomain.name;

        const now = DateTime.now();
        const yesterday = now.plus({ days: -1 });

        const todayString = now.startOf("day").toJSDate().toISOString();
        const yesterdayString = yesterday
            .startOf("day")
            .toJSDate()
            .toISOString();

        const redisLookupStats = await RedisMemoryService.client?.cFetch(
            "lookupStats",
            fullIdentifier
        );
        let noOfLookups = 0;
        let noOfLookupsToday = 0;
        let noOfLookupsYesterday = 0;
        if (redisLookupStats) {
            noOfLookups = redisLookupStats.lookups;
            noOfLookupsToday =
                redisLookupStats.dailyLookups.find(
                    (x) => x.date.slice(0, 10) === todayString.slice(0, 10)
                )?.lookups ?? 0;
            noOfLookupsYesterday =
                redisLookupStats.dailyLookups.find(
                    (x) => x.date.slice(0, 10) === yesterdayString.slice(0, 10)
                )?.lookups ?? 0;
        }

        const stats: NostrAddressStatisticsOutput = {
            id: registrationId,
            noOfLookups,
            noOfLookupsToday,
            noOfLookupsYesterday,
        };

        return stats;
    }

    // #endregion Queries

    // #region Mutations

    @Mutation((returns) => UserTokenOutput)
    async redeemRegistrationCode(
        @Args() args: RegistrationCodeRedeemInput
    ): Promise<UserTokenOutput> {
        await cleanupExpiredRegistrationsAsync();

        const dbRegistration =
            await PrismaService.instance.db.registration.findFirst({
                where: { id: args.registrationId, userId: args.userId },
                include: { registrationCode: true, user: true },
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
        const updatedDbRegistration =
            await PrismaService.instance.db.registration.update({
                where: { id: dbRegistration.id },
                data: {
                    verifiedAt: now.toJSDate(),
                },
                include: { systemDomain: true },
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

        // Notify user about successful registration.
        new Promise(async (resolve, reject) => {
            const nip05 = `${updatedDbRegistration.identifier}@${updatedDbRegistration.systemDomain.name}`;
            const message =
                `Thank you for registering ${nip05} as Nostr address.` +
                " \n\nVisit your account section to enable Lightning Address and Email Forwarding" +
                " or just to see some statistics about your Nostr address usage." +
                " \n\nhttps://nip05.social";

            const relays =
                await Nip05NostrService.instance.getRelevantAccountRelays(
                    dbRegistration.user.pubkey
                );
            await Nip05NostrService.instance
                .sendDMFromBot(dbRegistration.user.pubkey, relays, message)
                .then((relays) => {
                    console.log(relays);
                });
        });

        return dbUserToken;
    }

    @Mutation((returns) => CreateRegistrationNip46CodeOutput)
    async createRegistrationNip46Code(
        @Ctx() context: GraphqlContext,
        @Arg("pubkey") pubkey: string,
        @Arg("name") name: string,
        @Arg("systemDomainId", (type) => Int) systemDomainId: number
    ): Promise<CreateRegistrationNip46CodeOutput> {
        await cleanupExpiredRegistrationsAsync();
        const now = DateTime.now();

        const pubkeyObject = NostrHelperV2.getNostrPubkeyObject(pubkey);

        const dbUser = await getOrCreateUserInDatabaseAsync(pubkeyObject.hex);

        // Only continue, if the user was NOT reported as fraud.
        if (dbUser.fraudReportedAt != null) {
            throw new Error(ErrorMessage.fraud);
        }

        const checked = await HelperIdentifier.canIdentifierBeRegisteredAsync(
            name,
            systemDomainId,
            pubkeyObject.hex
        );

        if (!checked.canBeRegistered) {
            throw new Error(checked.reason);
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

        // Check if the registration already exists
        let dbRegistration = await context.db.registration.findFirst({
            where: {
                userId: dbUser.id,
                identifier: checked.name,
                systemDomainId,
            },
        });

        if (!dbRegistration) {
            // Registration does NOT exist. Create it.
            dbRegistration =
                await PrismaService.instance.db.registration.create({
                    data: {
                        userId: dbUser.id,
                        identifier: checked.name,
                        systemDomainId: systemDomainId,
                        createdAt: now.toJSDate(),
                        validUntil: now
                            .plus({ minute: registrationValidityInMinutes })
                            .toJSDate(),
                        verifiedAt: null,
                        lightningAddress: null,
                    },
                });
        }

        // Create or update
        const code = uuid.v4();
        const dbRegistrationCode =
            await PrismaService.instance.db.registrationNip46Code.upsert({
                where: { registrationId: dbRegistration.id },
                update: {
                    code,
                    createdAt: now.toJSDate(),
                    validUntil: now
                        .plus({
                            minute: 2,
                        })
                        .toJSDate(),
                },
                create: {
                    registrationId: dbRegistration.id,
                    code,
                    createdAt: now.toJSDate(),
                    validUntil: now
                        .plus({
                            minute: 2,
                        })
                        .toJSDate(),
                },
            });

        return {
            code,
            registrationId: dbRegistration.id,
        };
    }

    @Mutation((returns) => CreateRegistrationNip07CodeOutput)
    async createRegistrationNip07Code(
        @Ctx() context: GraphqlContext,
        @Arg("pubkey") pubkey: string,
        @Arg("name") name: string,
        @Arg("systemDomainId", (type) => Int) systemDomainId: number
    ): Promise<CreateRegistrationNip07CodeOutput> {
        await cleanupExpiredRegistrationsAsync();
        const now = DateTime.now();

        let pubkeyObject: NostrPubkeyObject | undefined;
        try {
            pubkeyObject = NostrHelperV2.getNostrPubkeyObject(pubkey);
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

        const checked = await HelperIdentifier.canIdentifierBeRegisteredAsync(
            name,
            systemDomainId,
            pubkeyObject.hex
        );

        if (!checked.canBeRegistered) {
            throw new Error(checked.reason);
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

        // Check if the registration already exists
        let dbRegistration = await context.db.registration.findFirst({
            where: {
                userId: dbUser.id,
                identifier: checked.name,
                systemDomainId,
            },
        });

        if (!dbRegistration) {
            // Registration does NOT exist. Create it.
            dbRegistration =
                await PrismaService.instance.db.registration.create({
                    data: {
                        userId: dbUser.id,
                        identifier: checked.name,
                        systemDomainId: systemDomainId,
                        createdAt: now.toJSDate(),
                        validUntil: now
                            .plus({ minute: registrationValidityInMinutes })
                            .toJSDate(),
                        verifiedAt: null,
                        lightningAddress: null,
                    },
                });
        }

        const registrationNip07CodeValidityInMinutes =
            await PrismaService.instance.getSystemConfigAsNumberAsync(
                SystemConfigId.RegistrationNip07CodeValidityInMinutes
            );
        if (!registrationNip07CodeValidityInMinutes) {
            throw new Error("Invalid system config. Please contact support.");
        }

        // Create or update
        const code = uuid.v4();
        const dbRegistrationCode =
            await PrismaService.instance.db.registrationNip07Code.upsert({
                where: { registrationId: dbRegistration.id },
                update: {
                    code,
                    createdAt: now.toJSDate(),
                    validUntil: now
                        .plus({
                            minute: registrationNip07CodeValidityInMinutes,
                        })
                        .toJSDate(),
                },
                create: {
                    registrationId: dbRegistration.id,
                    code,
                    createdAt: now.toJSDate(),
                    validUntil: now
                        .plus({
                            minute: registrationNip07CodeValidityInMinutes,
                        })
                        .toJSDate(),
                },
            });

        return {
            code,
            registrationId: dbRegistration.id,
        };
    }

    @Mutation((returns) => UserTokenOutput)
    async redeemRegistrationNip46Code(
        @Ctx() context: GraphqlContext,
        @Args() args: RegistrationNip46RedeemInputArgs
    ): Promise<UserTokenOutput> {
        const now = DateTime.now();
        await cleanupExpiredRegistrationsAsync();

        const pubkeyObject = NostrHelperV2.getNostrPubkeyObject(
            args.data.pubkey
        );

        const dbRegistration = await context.db.registration.findFirst({
            where: { id: args.registrationId },
            include: {
                registrationNip46Code: true,
                user: true,
            },
        });

        if (
            !dbRegistration ||
            dbRegistration.user.pubkey !== pubkeyObject.hex ||
            !dbRegistration.registrationNip46Code
        ) {
            throw new Error("Cannot find registration.");
        }

        if (dbRegistration.verifiedAt) {
            throw new Error("Registration is already validated.");
        }

        // Check 1: Has the code already expired
        if (dbRegistration.registrationNip46Code.validUntil < now.toJSDate()) {
            throw new Error(
                "The registration has already expired. Please try again."
            );
        }

        // Check 2: The content includes the server side generated code.
        if (
            !args.data.content.includes(
                dbRegistration.registrationNip46Code.code
            )
        ) {
            throw new Error("The provided content is not valid");
        }

        // Check 3: The provided event-signature is valid.
        if (!verifyEvent(args.data)) {
            throw new Error("The signature is invalid.");
        }

        // Everything checks out. Finalize registration.
        await PrismaService.instance.db.registration.update({
            where: { id: dbRegistration.id },
            data: {
                verifiedAt: now.toJSDate(),
            },
        });

        await PrismaService.instance.db.registrationNip46Code.delete({
            where: { id: dbRegistration.registrationNip46Code.id },
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

    @Mutation((returns) => UserTokenOutput)
    async redeemRegistrationNip07Code(
        @Ctx() context: GraphqlContext,
        @Args() args: RegistrationNip07RedeemInputArgs
    ): Promise<UserTokenOutput> {
        const now = DateTime.now();
        await cleanupExpiredRegistrationsAsync();

        let pubkeyObject: NostrPubkeyObject | undefined;
        try {
            pubkeyObject = NostrHelperV2.getNostrPubkeyObject(args.data.pubkey);
        } catch (error) {
            throw new Error(
                "Invalid pubkey. Please provide the pubkey either in npub or hex representation."
            );
        }

        const dbRegistration = await context.db.registration.findFirst({
            where: { id: args.registrationId },
            include: {
                registrationNip07Code: true,
                user: true,
            },
        });

        if (
            !dbRegistration ||
            dbRegistration.user.pubkey !== pubkeyObject.hex ||
            !dbRegistration.registrationNip07Code
        ) {
            throw new Error("Cannot find registration.");
        }

        if (dbRegistration.verifiedAt) {
            throw new Error("Registration is already validated.");
        }

        // Check 1: Has the code already expired
        if (dbRegistration.registrationNip07Code.validUntil < now.toJSDate()) {
            throw new Error(
                "The registration has already expired. Please try again."
            );
        }

        // Check 2: The content includes the server side generated code.
        if (
            !args.data.content.includes(
                dbRegistration.registrationNip07Code.code
            )
        ) {
            throw new Error("The provided content is not valid");
        }

        // Check 3: The provided event-signature is valid.
        if (!verifyEvent(args.data)) {
            throw new Error("The signature is invalid.");
        }

        // Everything checks out. Finalize registration.
        const updatedDbRegistration =
            await PrismaService.instance.db.registration.update({
                where: { id: dbRegistration.id },
                data: {
                    verifiedAt: now.toJSDate(),
                },
                include: { systemDomain: true },
            });

        await PrismaService.instance.db.registrationNip07Code.delete({
            where: { id: dbRegistration.registrationNip07Code.id },
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

        // Notify user about successful registration.
        new Promise(async (resolve, reject) => {
            const nip05 = `${updatedDbRegistration.identifier}@${updatedDbRegistration.systemDomain.name}`;
            const message =
                `Thank you for registering ${nip05} as Nostr address.` +
                " \n\nVisit your account section to enable Lightning Address and Email Forwarding" +
                " or just to see some statistics about your Nostr address usage." +
                " \n\nhttps://nip05.social";

            const relays =
                await Nip05NostrService.instance.getRelevantAccountRelays(
                    dbRegistration.user.pubkey
                );
            await Nip05NostrService.instance
                .sendDMFromBot(dbRegistration.user.pubkey, relays, message)
                .then((relays) => {
                    console.log(relays);
                });
        });

        return dbUserToken;
    }

    @Mutation((returns) => RegistrationOutput)
    async createRegistrationCode(
        @Ctx() context: GraphqlContext,
        @Args() args: RegistrationCodeCreateInput
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
            args.name,
            args.systemDomainId,
            pubkeyObject.hex
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

        const registrationCodeValidityInMinutes =
            await PrismaService.instance.getSystemConfigAsNumberAsync(
                SystemConfigId.RegistrationCodeValidityInMinutes
            );
        if (!registrationCodeValidityInMinutes) {
            throw new Error("Invalid system config. Please contact support.");
        }

        // Create registration in database
        const dbRegistration =
            await PrismaService.instance.db.registration.create({
                data: {
                    userId: dbUser.id,
                    identifier: check.name,
                    systemDomainId: args.systemDomainId,
                    createdAt: now.toJSDate(),
                    validUntil: now
                        .plus({ minute: registrationValidityInMinutes })
                        .toJSDate(),
                    verifiedAt: null,
                    lightningAddress: null,
                },
            });

        const code = HelperAuth.generateCode();
        const dbRegistrationCode =
            await PrismaService.instance.db.registrationCode.create({
                data: {
                    registrationId: dbRegistration.id,
                    code,
                    createdAt: now.toJSDate(),
                    validUntil: now
                        .plus({ minute: registrationCodeValidityInMinutes })
                        .toJSDate(),
                },
            });

        ///////////////

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

Click here to finalize your registration:

${aUrl}/aregister/${dbRegistration.userId}/${dbRegistration.id}/${
            dbRegistrationCode.code
        }
`;

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

        let relays: string[] = [];
        if (!args.relay) {
            relays = await Nip05NostrService.instance.getRelevantAccountRelays(
                dbUser.pubkey
            );
        } else {
            relays.push(args.relay);
        }

        await Nip05NostrService.instance.sendDMFromBot(
            dbUser.pubkey,
            relays,
            content
        );

        return dbRegistration;
    }

    @Mutation((returns) => Boolean)
    async resendRegistrationCode(
        @Ctx() context: GraphqlContext,
        @Args() args: RegistrationCodeResendInput
    ): Promise<boolean> {
        await cleanupExpiredRegistrationsAsync();

        const dbRegistration = await context.db.registration.findFirst({
            where: { id: args.registrationId, userId: args.userId },
            include: {
                registrationCode: true,
                user: true,
            },
        });

        if (!dbRegistration || !dbRegistration.registrationCode) {
            throw new Error("No registration found with the provided id.");
        }

        const code = dbRegistration.registrationCode.code;

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
            
${Array.from(code).join(" ")}

Click here to finalize your registration:

${aUrl}/aregister/${dbRegistration.userId}/${dbRegistration.id}/${code}

`;

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

        let relays: string[] = [];
        if (!args.relay) {
            relays = await Nip05NostrService.instance.getRelevantAccountRelays(
                dbRegistration.user.pubkey
            );
        } else {
            relays.push(args.pubkey);
        }

        await Nip05NostrService.instance.sendDMFromBot(
            dbRegistration.user.pubkey,
            relays,
            content
        );

        return true;
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
            include: { user: true, systemDomain: true },
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
            throw new Error("Invalid lightning address.");
        }

        const updatedDbRegistration = await context.db.registration.update({
            where: { id: args.registrationId },
            data: {
                lightningAddress: cleanedLightningAddress,
                emailForwardingOn: args.data.emailForwardingOn,
                emailOut: args.data.emailOut,
                emailOutSubject: args.data.emailOutSubject,
            },
        });

        const nAddress = `${dbRegistration.identifier}@${dbRegistration.systemDomain.name}`;
        if (
            !dbRegistration.emailForwardingOn &&
            updatedDbRegistration.emailForwardingOn
        ) {
            // The uer has turned on "Receive Emails on Nostr".
            const text =
                `INFO: NIP05.social\n\n` +
                `You have activated "Receive Emails on Nostr" for your #nostr address ${nAddress}\n\n` +
                `We will deliver #emails to that address as direct messages to the following relays:\n\n` +
                `+ all relays you have configured in your account section\n\n` +
                `+ all relays from NIP-65 relay lists you published on these\n\n` +
                `+ relay.nip05.social (our private relay for registered users)\n\n` +
                `If you add our relay to your client's relay list, please make sure that` +
                ` your client supports NIP-42 authentication.`;
            Nip05NostrService.instance
                .getRelevantAccountRelays(dbRegistration.user.pubkey)
                .then(async (relays) => {
                    await Nip05NostrService.instance.sendDMFromBot(
                        dbRegistration.user.pubkey,
                        relays,
                        text as string
                    );
                });
        }

        if (!dbRegistration.emailOut && updatedDbRegistration.emailOut) {
            // The user has turned on "Send Emails from Nostr".
            const text =
                `INFO: NIP05.social\n\n` +
                `You have activated "Send Emails from Nostr" for your #nostr address ${nAddress}\n` +
                `\n` +
                `In oder to send #emails as direct messages on #nostr, you need to add our` +
                ` private relay relay.nip05.social to your client's relay list. Please make` +
                ` sure that your client supports NIP-42 authentication.\n` +
                `\n` +
                `You have 2 options to send emails:\n` +
                `\n` +
                `a) send a direct message to our dedicated` +
                ` @npub16zy56kkwwrhzp9m56px4hx4wj8h69rk7r92ppqcqc3x6h7lpmxeq7cyjuy` +
                ` IN A VERY SPECIFIC FORMAT\n` +
                `\n` +
                `b) respond to a previously received direct message from one of our email mirror accounts\n` +
                `\n` +
                `For both options, you can always send a direct message to the bot or` +
                ` the mirror accounts with just the content "help",` +
                ` and we will automatically respond with a message explaining all your options.`;
            Nip05NostrService.instance
                .getRelevantAccountRelays(dbRegistration.user.pubkey)
                .then(async (relays) => {
                    await Nip05NostrService.instance.sendDMFromBot(
                        dbRegistration.user.pubkey,
                        relays,
                        text as string
                    );
                });
        }

        return updatedDbRegistration;
    }

    // #endregion Mutations
}

