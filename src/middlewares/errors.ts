import { NextFunction, Request, Response } from "express";

export const errorHandler = (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    console.log(`ERROR - [system] - ${err}`);
    res.status(500).send({ errors: [{ message: "Something went wrong" }] });
};

