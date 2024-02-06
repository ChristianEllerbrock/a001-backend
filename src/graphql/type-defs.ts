import { PrismaClient, User } from "@prisma/client";
import { IncomingMessage } from "node:http";
import { AuthChecker } from "type-graphql";
import { PrismaService } from "../services/prisma-service";
import * as uuid from "uuid";
import { DateTime } from "luxon";
import { SystemConfigId } from "../prisma/assortments";
import { UserTokenOutput } from "./outputs/user-token-output";
import { OperationContext } from "graphql-http";
import { Request } from "express";
import { RequestContext } from "graphql-http/lib/use/express";

export enum Role {
    Admin = "Admin",
}

export interface GraphqlContext {
    db: PrismaClient;
    req: {
        protocol: string;
        hostname: string;
        domain: string;
    };
    user: GraphqlContextUser | undefined;
}

class GraphqlContextUser {
    #hasValidToken: boolean | undefined;
    #isSystemUser: boolean | undefined;

    constructor(
        public userId: string | undefined,
        public userToken: string | undefined,
        public deviceId: string | undefined
    ) {}

    async hasValidTokenAsync(): Promise<boolean> {
        if (typeof this.#hasValidToken !== "undefined") {
            return this.#hasValidToken;
        }

        if (
            typeof this.userId === "undefined" ||
            typeof this.userToken === "undefined" ||
            typeof this.deviceId === "undefined"
        ) {
            this.#hasValidToken = false;
            return false;
        }

        const dbUserToken = await PrismaService.instance.db.userToken.findFirst(
            {
                where: {
                    userId: this.userId,
                    deviceId: this.deviceId,
                    token: this.userToken,
                },
            }
        );

        if (!dbUserToken) {
            this.#hasValidToken = false;
            return false;
        }

        // Check validity
        this.#hasValidToken = Date.now() < dbUserToken.validUntil.getTime();
        return this.#hasValidToken;
    }

    async isSystemUser(): Promise<boolean> {
        if (typeof this.#isSystemUser !== "undefined") {
            return this.#isSystemUser;
        }

        if (
            typeof this.userId === "undefined" ||
            typeof this.userToken === "undefined" ||
            typeof this.deviceId === "undefined"
        ) {
            this.#isSystemUser = false;
            return false;
        }

        const dbUser = await PrismaService.instance.db.user.findUnique({
            where: { id: this.userId },
        });

        if (dbUser?.isSystemUser === true) {
            this.#isSystemUser = true;
            return true;
        }

        this.#isSystemUser = false;
        return false;
    }
}

export const getGraphqlContext2 = function (request: any): OperationContext {
    const req = request.raw;
    const context: Record<string, any> = {};

    let userId: string | undefined;
    let userToken: string | undefined;
    let deviceId: string | undefined;
    try {
        const value1 = req.headers["nip05socialuserid"];
        userId = Array.isArray(value1) ? undefined : value1;

        const value2 = req.headers["nip05socialauthorization"];
        userToken = Array.isArray(value2) ? undefined : value2;

        const value3 = req.headers["nip05socialdeviceid"];
        deviceId = Array.isArray(value3) ? undefined : value3;
    } catch (error) {
        console.log(error);
    }

    const hostname = (req as any).hostname;
    const protocol = (req as any).protocol;
    const hostnameParts = hostname.toLowerCase().split(".");
    const lastIndex = hostnameParts.length - 1;
    const domain =
        hostnameParts[lastIndex - 1] + "." + hostnameParts[lastIndex];

    const user =
        typeof userId !== "undefined" &&
        typeof userToken !== "undefined" &&
        typeof deviceId !== "undefined"
            ? new GraphqlContextUser(userId, userToken, deviceId)
            : undefined;

    context["db"] = PrismaService.instance.db;
    context["user"] = user;
    context["req"] = {
        hostname,
        protocol,
        domain,
    };

    return context;
};

// export const getGraphqlContext = function (
//     req: IncomingMessage
// ): GraphqlContext {
//     let userId: string | undefined;
//     let userToken: string | undefined;
//     let deviceId: string | undefined;
//     try {
//         const value1 = req.headers["nip05socialuserid"];
//         userId = Array.isArray(value1) ? undefined : value1;

//         const value2 = req.headers["nip05socialauthorization"];
//         userToken = Array.isArray(value2) ? undefined : value2;

//         const value3 = req.headers["nip05socialdeviceid"];
//         deviceId = Array.isArray(value3) ? undefined : value3;
//     } catch (error) {
//         console.log(error);
//     }

//     const hostname = (req as any).hostname;
//     const protocol = (req as any).protocol;
//     const hostnameParts = hostname.toLowerCase().split(".");
//     const lastIndex = hostnameParts.length - 1;
//     const domain =
//         hostnameParts[lastIndex - 1] + "." + hostnameParts[lastIndex];

//     const user =
//         typeof userId !== "undefined" &&
//         typeof userToken !== "undefined" &&
//         typeof deviceId !== "undefined"
//             ? new GraphqlContextUser(userId, userToken, deviceId)
//             : undefined;

//     return {
//         db: PrismaService.instance.db,
//         user,
//         req: {
//             hostname,
//             protocol,
//             domain,
//         },
//     };
// };

export const customAuthChecker: AuthChecker<GraphqlContext> = async (
    { root, args, context, info },
    roles
) => {
    // Check if the context user object has a valid token.
    if (!context.user) {
        return false;
    }

    const hasValidToken = await context.user.hasValidTokenAsync();
    if (!hasValidToken) {
        return false;
    }

    if (roles.empty()) {
        return true;
    }

    // We have roles. Currently only Role.Admin (i.e. SystemUser in the database).
    return await context.user.isSystemUser();
};

export const getOrCreateUserInDatabaseAsync = async (
    hex: string
): Promise<User> => {
    let dbUser = await PrismaService.instance.db.user.findFirst({
        where: { pubkey: hex },
    });
    if (!dbUser) {
        dbUser = await PrismaService.instance.db.user.create({
            data: {
                pubkey: hex,
                createdAt: new Date(),
                isSystemUser: false,
            },
        });
    }

    return dbUser;
};

export const updateUserToken = async (
    userId: string,
    deviceId: string
): Promise<UserTokenOutput> => {
    const now = DateTime.now();
    const userTokenValidityInMinutes =
        await PrismaService.instance.getSystemConfigAsNumberAsync(
            SystemConfigId.UserTokenValidityInMinutes
        );

    if (!userTokenValidityInMinutes) {
        throw new Error("Invalid system config. Please contact support.");
    }

    const validUntil = now
        .plus({ minute: userTokenValidityInMinutes })
        .toJSDate();
    const token = uuid.v4();

    const dbUserToken = await PrismaService.instance.db.userToken.upsert({
        where: {
            userId_deviceId: {
                userId,
                deviceId,
            },
        },
        update: {
            token,
            validUntil,
        },
        create: {
            userId,
            deviceId: deviceId,
            token,
            validUntil,
        },
    });

    return dbUserToken;
};

export const cleanAndAddUserFraudOption = async (
    userId: string
): Promise<string> => {
    const now = DateTime.now();
    const userFraudOptionValidityInDays =
        await PrismaService.instance.getSystemConfigAsNumberAsync(
            SystemConfigId.UserFraudOptionValidityInDays
        );

    // Delete all entries in dbo.UserFraudOption that are "older" than allowed.
    await PrismaService.instance.db.userFraudOption.deleteMany({
        where: {
            createAt: {
                lt: now
                    .minus({ day: userFraudOptionValidityInDays })
                    .toJSDate(),
            },
        },
    });

    // Create new entry in dbo.UserFraudOption
    const dbUserFraudOption =
        await PrismaService.instance.db.userFraudOption.create({
            data: {
                userId,
                createAt: now.toJSON(),
            },
        });

    return dbUserFraudOption.id;
};

