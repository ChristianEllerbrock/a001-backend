import { PrismaClient, User } from "@prisma/client";
import { IncomingMessage } from "node:http";
import { AuthChecker } from "type-graphql";
import { Nostr } from "../nostr/nostr";
import { PrismaService } from "../services/prisma-service";
import * as uuid from "uuid";
import { DateTime } from "luxon";
import { SystemConfigId } from "../prisma/assortments";
import { UserTokenOutput } from "./outputs/user-token-output";

export interface GraphqlContext {
    db: PrismaClient;
    user:
        | {
              userId: string;
              userToken: string;
              deviceId: string;
              hasValidTokenAsync: () => Promise<boolean>;
              isSystemUser: () => Promise<boolean>;
          }
        | undefined;
}

export const getGraphqlContext = function (
    req: IncomingMessage
): GraphqlContext {
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
    } catch (error) {}

    const user =
        typeof userId !== "undefined" &&
        typeof userToken !== "undefined" &&
        typeof deviceId !== "undefined"
            ? {
                  userId,
                  userToken,
                  deviceId,
                  hasValidTokenAsync: async (): Promise<boolean> => {
                      if (
                          typeof userId === "undefined" ||
                          typeof userToken === "undefined" ||
                          typeof deviceId === "undefined"
                      ) {
                          return false;
                      }

                      const dbUserToken =
                          await PrismaService.instance.db.userToken.findFirst({
                              where: {
                                  userId,
                                  deviceId,
                                  token: userToken,
                              },
                          });

                      if (!dbUserToken) {
                          return false;
                      }

                      // Check validity
                      return Date.now() < dbUserToken.validUntil.getTime()
                          ? true
                          : false;
                  },
                  isSystemUser: async (): Promise<boolean> => {
                      if (
                          typeof userId === "undefined" ||
                          typeof userToken === "undefined" ||
                          typeof deviceId === "undefined"
                      ) {
                          return false;
                      }

                      const dbUser =
                          await PrismaService.instance.db.user.findUnique({
                              where: { id: userId },
                          });

                      if (dbUser?.isSystemUser === true) {
                          return true;
                      }

                      return false;
                  },
              }
            : undefined;

    return {
        db: PrismaService.instance.db,
        user,
    };
};

export const customAuthChecker: AuthChecker<GraphqlContext> = async (
    { root, args, context, info },
    roles
) => {
    // Currently, only check if the context user object has a valid token.
    if (!context.user) {
        return false;
    }

    return await context.user.hasValidTokenAsync();
};

export const getOrCreateUserInDatabaseAsync = async (
    npub: string
): Promise<User> => {
    const pubkey = Nostr.npubToHexObject(npub).hex;

    let dbUser = await PrismaService.instance.db.user.findFirst({
        where: { pubkey },
    });
    if (!dbUser) {
        dbUser = await PrismaService.instance.db.user.create({
            data: {
                pubkey,
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

