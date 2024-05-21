/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextFunction, Request, Response } from "express";
import { PrismaService } from "../services/prisma-service";
import { PrismaClient } from "@prisma/client";

export type AuthenticatedRequest = Request & {
    context: {
        sql: PrismaClient;
    };
    user: {
        id: string;
        deviceId: string;
        isAuthenticated: boolean;
    };
};

const authMiddleware = async function (
    req: Request,
    res: Response,
    next: NextFunction
) {
    const bearer = req.headers["authorization"]
        ?.toLowerCase()
        .replace("bearer", "")
        .trim();

    if (!bearer) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }

    // The token looks like this:
    // {userId}_{deviceId}_{token}
    // 3f80633c-853a-4c15-8efd-12886418e58d_3d97bb9c-51f6-4e94-83b6-2b874e523706_d11ab33c-86cf-4085-865f-9befac450f48

    const [userId, deviceId, token] = bearer.split("_");

    const db = PrismaService.instance.db;

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
        res.status(401).json({ message: "Unauthorized" });
        return;
    }

    // The user is authenticated.
    // Inject some data into the request object.

    const user = {
        id: userId,
        isAuthenticated: true,
        deviceId,
    };

    const context = {
        sql: db,
    };

    (req as AuthenticatedRequest).user = user;
    (req as AuthenticatedRequest).context = context;

    next();
};

export default authMiddleware;

