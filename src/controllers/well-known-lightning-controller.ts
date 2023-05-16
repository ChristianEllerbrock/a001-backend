import { NextFunction, Request, Response } from "express";
import { PrismaService } from "../services/prisma-service";
import { DateTime } from "luxon";
import axios from "axios";

interface Query {
    name?: string;
}

class ErrorResponse {
    status = "ERROR";

    constructor(public reason: string) {}
}

export async function wellKnownLightningController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const today = DateTime.now().startOf("day");
        const now = DateTime.now();

        const username = req.params.username;

        // Determine the domain from the request.
        let domain = "";
        if (req.hostname.includes("localhost")) {
            domain = "nip05.social";
        } else {
            const hostnameParts = req.hostname.toLowerCase().split(".");
            const lastIndex = hostnameParts.length - 1;
            domain = (
                hostnameParts[lastIndex - 1] +
                "." +
                hostnameParts[lastIndex]
            ).toLowerCase();
        }

        console.log(
            `LN GET for username: '${username}' on domain: '${domain}'`
        );

        const dbSystemDomain =
            await PrismaService.instance.db.systemDomain.findFirst({
                where: { name: domain },
            });

        const dbRegistration =
            await PrismaService.instance.db.registration.findFirst({
                where: {
                    identifier: username.toLowerCase(),
                    systemDomainId: dbSystemDomain?.id ?? -1,
                },
            });

        if (!dbRegistration) {
            const error = new ErrorResponse(
                `Unable to find a registration for '${username}@${domain}'`
            );
            res.json(error);
            return;
        }

        if (!dbRegistration.lightningAddress) {
            const error = new ErrorResponse(
                `No lightning address forward configured for '${username}@${domain}'`
            );
            res.json(error);
            return;
        }

        const lnAddress = dbRegistration.lightningAddress.split("@");

        const lnUrl = `https://${lnAddress[1]}/.well-known/lnurlp/${lnAddress[0]}`;
        const response = await axios.get(lnUrl);

        res.json(response.data);
    } catch (error) {
        next(error);
    }
}

