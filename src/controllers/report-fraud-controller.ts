import { Prisma } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { PrismaService } from "../services/prisma-service";
import { Nostr } from "../nostr/nostr";
import { SystemConfigId } from "../prisma/assortments";

export async function reportFraudController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.params.userId;
        const fraudId = req.params.fraudId;

        const userFraudOptionValidityInDays =
            await PrismaService.instance.getSystemConfigAsNumberAsync(
                SystemConfigId.UserFraudOptionValidityInDays
            );

        const dbUserFraudOption =
            await PrismaService.instance.db.userFraudOption.findFirst({
                where: {
                    id: fraudId,
                    userId,
                },
                include: {
                    user: true,
                },
            });

        if (dbUserFraudOption) {
            if (dbUserFraudOption.user.fraudReportedAt != null) {
                res.render(__dirname + "/pages/report-fraud-notok.html", {
                    message: "Pubkey is already blocked.",
                });
            } else {
                res.render(__dirname + "/pages/report-fraud-ok.html", {
                    url: req.baseUrl + `/confirm-fraud/${userId}/${fraudId}`,
                    npub: Nostr.Pubkey2nPub(dbUserFraudOption?.user.pubkey),
                });
            }
        } else {
            res.render(__dirname + "/pages/report-fraud-notok.html", {
                message: `Link invalid. Please note that all fraud links are only valid for ${userFraudOptionValidityInDays} days.`,
            });
        }
    } catch (error) {
        next(error);
    }
}

