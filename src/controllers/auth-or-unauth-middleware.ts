import { PrismaClient } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { PrismaService } from "../services/prisma-service";
import { validate } from "uuid";

export type AuthOrUnauthRequest = Request & {
    context: {
        sql: PrismaClient;
    };

    isAuthenticated: boolean;

    /** If the request includes a valid token, the user object will be populated. */
    user?: {
        id: string;
        deviceId: string;
    };
};

const authOrUnauthMiddleware = async function (
    req: Request,
    res: Response,
    next: NextFunction
) {
    const db = PrismaService.instance.db;
    const context = {
        sql: db,
    };
    (req as AuthOrUnauthRequest).context = context;
    (req as AuthOrUnauthRequest).isAuthenticated = false;

    const bearer = req.headers["authorization"]
        ?.toLowerCase()
        .replace("bearer", "")
        .trim();

    if (bearer) {
        // The request MIGHT contain a valid token.

        // The token looks like this:
        // {userId}_{deviceId}_{token}
        // 3f80633c-853a-4c15-8efd-12886418e58d_3d97bb9c-51f6-4e94-83b6-2b874e523706_d11ab33c-86cf-4085-865f-9befac450f48

        const [userId, deviceId, token] = bearer.split("_");

        // Sanity check 1:
        // Check if the userId, deviceId, and token are not empty.
        if (!userId || !deviceId || !token) {
            next();
            return;
        }

        // Sanity check 2:
        // Check if the userId, deviceId, and token are valid UUIDs.
        if (!validate(userId) || !validate(deviceId) || !validate(token)) {
            next();
            return;
        }

        // Everything looks good. Check the database for the token.

        const sqlToken = await db.userToken.findFirst({
            where: {
                userId,
                deviceId,
                token,
                validUntil: {
                    gte: new Date(),
                },
            },
        });

        if (!sqlToken) {
            next();
            return;
        }

        // The provided token is valid. Set the user object in the request.
        const user = {
            id: userId,
            isAuthenticated: true,
            deviceId,
        };

        (req as AuthOrUnauthRequest).user = user;
        (req as AuthOrUnauthRequest).isAuthenticated = true;
    }

    next();
};

export default authOrUnauthMiddleware;

