import { PrismaClient } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { PrismaService } from "../../services/prisma-service";

export type UnauthenticatedRequest = Request & {
    context: {
        sql: PrismaClient;
    };
};

const unauthMiddleware = async function (
    req: Request,
    res: Response,
    next: NextFunction
) {
    (req as UnauthenticatedRequest).context = {
        sql: PrismaService.instance.db,
    };

    next();
};

export default unauthMiddleware;

