import { Response, Request } from "express";
import { AuthOrUnauthRequest } from "../auth-or-unauth-middleware";
import {
    RegisterRedeemPostDto,
    RegisterRedeemResponseDto,
    RegisterRequestPostDto,
    RegisterRequestResponseDto,
} from "@open-api";
import { HelperIdentifier } from "../../helpers/identifier";
import { DateTime } from "luxon";
import { PrismaService } from "../../services/prisma-service";
import { NostrHelperV2 } from "../../nostr/nostr-helper-2";
import { User } from "@prisma/client";
import { v4 } from "uuid";
import { verifyEvent } from "nostr-tools";
import { Nip05NostrService } from "../../services/nip05-nostr/nip05-nostr-service";
import { RMService } from "../../services/redis-memory-service";

const registerRequest = async function (req: Request, res: Response) {
    const extendedReq = req as AuthOrUnauthRequest;
    const postDto = req.body as RegisterRequestPostDto;

    const now = DateTime.now();

    if (extendedReq.isAuthenticated) {
        const sqlUser = await extendedReq.context.sql.user.findUnique({
            where: { id: extendedReq.user?.id },
        });

        if (!sqlUser) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        const checked = await HelperIdentifier.canNostrAddressBeRegistered(
            postDto.nostrAddress,
            sqlUser.pubkey
        );

        if (!checked.canBeRegistered) {
            res.status(400).json({ message: checked.reason });
            return;
        }

        // Everything is fine. The user is authenticated and can register his desired nostr address.

        // Create registration in SQL database.
        const sqlRegistration =
            await extendedReq.context.sql.registration.create({
                data: {
                    userId: sqlUser.id,
                    identifier: checked.identifier,
                    systemDomainId: checked.systemDomainId,
                    createdAt: now.toJSDate(),
                    validUntil: now.plus({ minute: 1 }).toJSDate(),
                    verifiedAt: now.toJSDate(),
                    lightningAddress: null,
                },
            });

        const response: RegisterRequestResponseDto = {
            variantAuthenticated: {
                id: sqlRegistration.id,
                userId: sqlRegistration.userId,
                nostrAddress: checked.nostrAddress,
                lightningAddress: sqlRegistration.lightningAddress,
                emailIn: sqlRegistration.emailForwardingOn ?? false,
                emailOut: sqlRegistration.emailOut,
                emailOutSubject: sqlRegistration.emailOutSubject,
                relays: [],
            },
        };
        res.status(201).json(response);
        return;
    }

    if (postDto.viaNip07) {
        // The user is not authenticated, but wants to register via NIP07.
        await cleanupExpiredRegistrationsAsync();

        const pubkeyObject = NostrHelperV2.getNostrPubkeyObject(
            postDto.pubkey ?? ""
        );

        const [sqlUser /*, registrationRelays*/] =
            await getOrCreateUserInDatabaseAsync(pubkeyObject.hex);

        const checked = await HelperIdentifier.canNostrAddressBeRegistered(
            postDto.nostrAddress,
            sqlUser.pubkey
        );

        if (!checked.canBeRegistered) {
            res.status(400).json({ message: checked.reason });
            return;
        }

        // Check if the registration already exists
        let sqlRegistration =
            await extendedReq.context.sql.registration.findFirst({
                where: {
                    userId: sqlUser.id,
                    identifier: checked.identifier,
                    systemDomainId: checked.systemDomainId,
                },
            });

        if (!sqlRegistration) {
            // Registration does NOT exist. Create it.
            sqlRegistration = await extendedReq.context.sql.registration.create(
                {
                    data: {
                        userId: sqlUser.id,
                        identifier: checked.identifier,
                        systemDomainId: checked.systemDomainId,
                        createdAt: now.toJSDate(),
                        validUntil: now.plus({ minute: 10 }).toJSDate(),
                        verifiedAt: null,
                        lightningAddress: null,
                    },
                }
            );
        }

        // Create or update
        const code = v4();
        const sqlRegistrationCode =
            await extendedReq.context.sql.registrationNip07Code.upsert({
                where: { registrationId: sqlRegistration.id },
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
                    registrationId: sqlRegistration.id,
                    code,
                    createdAt: now.toJSDate(),
                    validUntil: now
                        .plus({
                            minute: 2,
                        })
                        .toJSDate(),
                },
            });

        const response: RegisterRequestResponseDto = {
            variantNip07: {
                registrationId: sqlRegistration.id,
                code: sqlRegistrationCode.code,
            },
        };

        res.status(201).json(response);
        return;
    }
};

const registerRedeem = async function (req: Request, res: Response) {
    const extendedReq = req as AuthOrUnauthRequest;
    const postDto = req.body as RegisterRedeemPostDto;

    const now = DateTime.now();

    await cleanupExpiredRegistrationsAsync();
    const pubkeyObject = NostrHelperV2.getNostrPubkeyObject(
        postDto.data.pubkey
    );

    const sqlRegistration =
        await extendedReq.context.sql.registration.findFirst({
            where: { id: postDto.registrationId },
            include: {
                registrationNip07Code: true,
                user: true,
            },
        });

    if (
        !sqlRegistration ||
        sqlRegistration.user.pubkey !== pubkeyObject.hex ||
        !sqlRegistration.registrationNip07Code
    ) {
        res.status(400).json({ message: "Cannot find registration." });
        return;
    }

    if (sqlRegistration.verifiedAt) {
        res.status(400).json({ message: "Registration is already validated" });
        return;
    }

    // Check 1: Has the code already expired
    if (sqlRegistration.registrationNip07Code.validUntil < now.toJSDate()) {
        res.status(400).json({
            message: "The registration already has expired",
        });
        return;
    }

    // Check 2: The content includes the server side generated code.
    if (
        !postDto.data.content.includes(
            sqlRegistration.registrationNip07Code.code
        )
    ) {
        res.status(400).json({ message: "The provided content is not valid" });
        return;
    }

    // Check 3: The provided event-signature is valid.
    if (!verifyEvent(postDto.data)) {
        res.status(400).json({ message: "The signature is invalid" });
        return;
    }

    // Everything checks out. Finalize registration.
    const updatedDbRegistration =
        await extendedReq.context.sql.registration.update({
            where: { id: sqlRegistration.id },
            data: {
                verifiedAt: now.toJSDate(),
            },
            include: {
                systemDomain: true,
                user: {
                    include: {
                        registrations: true,
                    },
                },
            },
        });

    await extendedReq.context.sql.registrationNip07Code.delete({
        where: { id: sqlRegistration.registrationNip07Code.id },
    });

    // Create or update user token.
    const sqlUserToken = await extendedReq.context.sql.userToken.upsert({
        where: {
            userId_deviceId: {
                userId: sqlRegistration.userId,
                deviceId: postDto.deviceId,
            },
        },
        update: {
            token: v4(),
            validUntil: now.plus({ minute: 1440 }).toJSDate(),
        },
        create: {
            userId: sqlRegistration.userId,
            deviceId: postDto.deviceId,
            token: v4(),
            validUntil: now.plus({ minute: 1440 }).toJSDate(),
        },
    });

    // Update global statistics and notify user about successful registration.
    // eslint-disable-next-line no-async-promise-executor
    new Promise(async (/*resolve, reject*/) => {
        const fullIdentifier = `${updatedDbRegistration.identifier}@${updatedDbRegistration.systemDomain.name}`;
        const usersRegistrations =
            updatedDbRegistration.user.registrations.filter(
                (x) => x.verifiedAt != null
            ).length;

        // Update global statistics.
        if (updatedDbRegistration.verifiedAt) {
            await updateGlobalUserStatsAfterRegistrationAdd(
                fullIdentifier,
                updatedDbRegistration.verifiedAt,
                usersRegistrations
            );
        }

        // Welcome user/registration via Nostr DM.
        const message =
            `Thank you for registering ${fullIdentifier} as Nostr address.` +
            " \n\nVisit your account section to enable Lightning Address and Email Forwarding" +
            " or just to see some statistics about your Nostr address usage." +
            " \n\nhttps://nip05.social";

        const relays =
            await Nip05NostrService.instance.getRelevantAccountRelays(
                sqlRegistration.user.pubkey
            );
        await Nip05NostrService.instance
            .sendDMFromBot(sqlRegistration.user.pubkey, relays, message)
            .then((relays) => {
                console.log(relays);
            });
    });

    const response: RegisterRedeemResponseDto = {
        token: sqlUserToken.token,
        validUntil: sqlUserToken.validUntil.toISOString(),
        deviceId: postDto.deviceId,
        userId: sqlRegistration.userId,
    };

    res.status(200).json(response);
};

const cleanupExpiredRegistrationsAsync = async () => {
    const now = DateTime.now();

    await PrismaService.instance.db.registration.deleteMany({
        where: {
            verifiedAt: null,
            validUntil: { lt: now.toJSDate() },
        },
    });
};

export const getOrCreateUserInDatabaseAsync = async (
    pubkey: string
): Promise<[sqlUser: User, registrationRelays: string[]]> => {
    const result = await PrismaService.instance.db.$transaction(
        async (db): Promise<[sqlUser: User, registrationRelays: string[]]> => {
            let sqlUser = await db.user.findFirst({
                where: { pubkey },
            });
            if (!sqlUser) {
                sqlUser = await db.user.create({
                    data: {
                        pubkey: pubkey,
                        createdAt: new Date(),
                        isSystemUser: false,
                    },
                });
            }

            const sqlRegistrations =
                (await db.registration.findMany({
                    where: { userId: sqlUser.id },
                    include: { registrationRelays: true },
                })) ?? [];

            const registrationRelays = sqlRegistrations
                .map((x) => x.registrationRelays.map((y) => y.address))
                .flat();

            return [sqlUser, registrationRelays];
        }
    );

    return result;
};

const updateGlobalUserStatsAfterRegistrationAdd = async (
    fullIdentifier: string,
    verifiedDate: Date,
    usersVerifiedRegistrations: number
) => {
    try {
        const domain = fullIdentifier.split("@")[1];

        const erGlobalUserStats = await RMService.i.globalUserStats.fetch();
        if (!erGlobalUserStats) {
            return;
        }

        if (usersVerifiedRegistrations === 1) {
            // This registration is the first verified registration of the user.
            erGlobalUserStats.data.noOfUsers += 1;
        }

        erGlobalUserStats.data.noOfRegistrations += 1;
        erGlobalUserStats.data.lastRegistrations.unshift({
            date: verifiedDate.toISOString() ?? "na",
            nip05: fullIdentifier,
        });
        erGlobalUserStats.data.lastRegistrations =
            erGlobalUserStats.data.lastRegistrations.slice(0, 10);

        if (
            typeof erGlobalUserStats.data.noOfRegistrationsPerDomain[domain] ===
            "undefined"
        ) {
            erGlobalUserStats.data.noOfRegistrationsPerDomain[domain] = 1;
        } else {
            erGlobalUserStats.data.noOfRegistrationsPerDomain[domain] += 1;
        }

        await erGlobalUserStats.save();
    } catch (error) {
        console.error(
            "Error updating global user stats after registration add",
            error
        );
    }
};

export default { registerRequest, registerRedeem };

