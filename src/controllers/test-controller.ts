import { NextFunction, Request, Response } from "express";

export async function testController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        res.json("Found me");
    } catch (error) {
        next(error);
    }
}

