import { NextFunction, Request, Response } from "express";
import { PrismaService } from "../services/prisma-service";
import { Nostr } from "../nostr/nostr";

interface ConfirmFraudControllerResponse {
    success: boolean;
    message?: string;
}

export async function confirmFraudController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.params.userId;
        const fraudId = req.params.fraudId;

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

        if (!dbUserFraudOption) {
            const response: ConfirmFraudControllerResponse = {
                success: false,
                message: "",
            };
            res.json();
        }

        if (dbUserFraudOption) {
            if (dbUserFraudOption.user.fraudReportedAt != null) {
                res.render(__dirname + "/pages/confirm-fraud-notok.html", {
                    message: "Pubkey is already blocked.",
                });
            } else {
                await PrismaService.instance.db.user.update({
                    where: { id: dbUserFraudOption.userId },
                    data: {
                        fraudReportedAt: new Date(),
                    },
                });

                await PrismaService.instance.db.userToken.deleteMany({
                    where: { userId },
                });

                await PrismaService.instance.db.userLoginCode.deleteMany({
                    where: { userId },
                });

                const npub = Nostr.Pubkey2nPub(dbUserFraudOption?.user.pubkey);

                res.render(__dirname + "/pages/confirm-fraud-ok.html", {
                    npub,
                });
            }
        } else {
            res.render(__dirname + "/pages/confirm-fraud-notok.html", {
                message: `Link invalid.`,
            });
        }
    } catch (error) {
        next(error);
    }
}

