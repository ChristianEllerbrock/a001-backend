import { NextFunction, Request, Response } from "express";
import { PrismaService } from "../services/prisma-service";
import { SystemConfigId } from "../prisma/assortments";
import { NostrHelperV2 } from "../nostr/nostr-helper-2";

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
                res.render("report-fraud-notok.html", {
                    message: "Pubkey is already blocked.",
                });
            } else {
                res.render("report-fraud-ok.html", {
                    url: req.baseUrl + `/confirm-fraud/${userId}/${fraudId}`,
                    npub: NostrHelperV2.pubkey2npub(
                        dbUserFraudOption?.user.pubkey
                    ),
                });
            }
        } else {
            res.render("report-fraud-notok.html", {
                message: `Link invalid. Please note that all fraud links are only valid for ${userFraudOptionValidityInDays} days.`,
            });
        }
    } catch (error) {
        next(error);
    }
}

