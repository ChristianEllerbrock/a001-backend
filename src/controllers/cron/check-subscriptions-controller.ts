import { NextFunction, Request, Response } from "express";
import { EnvService } from "../../services/env-service";
import { PrismaService } from "../../services/prisma-service";
import { Nip05NostrService } from "../../services/nip05-nostr/nip05-nostr-service";
import { sleep } from "../../helpers/sleep";
import { DateTime } from "luxon";

const log = function (text: string | object) {
    console.log(`CHECK SUBSCRIPTIONS - [controller] - ${JSON.stringify(text)}`);
};

export async function checkSubscriptions(
    req: Request,
    res: Response,
    next: NextFunction
) {
    log("Triggered");

    const apiKey = req.headers["x-auth-token"];
    if (
        typeof apiKey === "undefined" ||
        apiKey !== EnvService.instance.env.API_ADMIN_KEY
    ) {
        res.sendStatus(401);
        log("Invalid x-auth-token.");
        return;
    }

    // Call async function WITHOUT await to directly return a value.
    runCheckSubscriptions();

    res.json("OK");
}

const message_DowngradedToBasic =
    "Your paid subscription has expired and your account was downgraded to the free BASIC plan." +
    " You can upgrade your plan at any time on https://nip05.social";

const message_14DaysLeft =
    "You have 14 days left before your paid subscription expires and you will be downgraded to the free BASIC plan." +
    " Log in to your account and prolong your subscription on https://nip05.social";

const message_7DaysLeft =
    "You have 7 days left before your paid subscription expires and you will be downgraded to the free BASIC plan." +
    " Log in to your account and prolong your subscription on https://nip05.social";

const message_3DaysLeft =
    "You have 3 days left before your paid subscription expires and you will be downgraded to the free BASIC plan." +
    " Log in to your account and prolong your subscription on https://nip05.social";

const message_1DaysLeft =
    "You have 1 day left before your paid subscription expires and you will be downgraded to the free BASIC plan." +
    " Log in to your account and prolong your subscription on https://nip05.social";

const runCheckSubscriptions = async function () {
    const now = new Date();
    const nowDateTime = DateTime.fromJSDate(now);

    //
    // 1. Check for subscriptions that have expired
    // => Downgrade them to the free plan (subscriptionId = 1).
    //
    const dbUsersWithExpiredSubscription =
        await PrismaService.instance.db.user.findMany({
            where: {
                subscriptionEnd: { lte: now },
            },
        });

    for (const user of dbUsersWithExpiredSubscription) {
        log(`Downgrade account '${user.pubkey}' to the free plan.`);
        const oldSubscriptionId = user.subscriptionId;
        const newSubscriptionId = 1;

        await PrismaService.instance.db.user.update({
            where: { id: user.id },
            data: {
                subscriptionId: newSubscriptionId,
                subscriptionEnd: null,
            },
        });

        await PrismaService.instance.db.userSubscription.create({
            data: {
                userId: user.id,
                oldSubscriptionId,
                newSubscriptionId,
                pending: false,
                cancelled: false,
                createdAt: now,
            },
        });

        // Notify user about expiration.
        const relevantUserRelays = await determineRelevantRelays(user.id);
        await Nip05NostrService.instance.sendDMFromBot(
            user.pubkey,
            relevantUserRelays,
            message_DowngradedToBasic
        );
        await sleep(1000); // Just to be sure to not stress the relays.
    }

    //
    // 2. Check for subscriptions that will expire shortly
    // => Notify the user if necessary.
    //
    const offset = 0.042;
    const inDays14 = nowDateTime.plus({ days: 14 + offset });
    const inDays7 = nowDateTime.plus({ days: 7 + offset });
    const inDays3 = nowDateTime.plus({ days: 3 + offset });
    const inDays1 = nowDateTime.plus({ days: 1 + offset });

    const dbUserWithSubscriptionAboutToExpire =
        await PrismaService.instance.db.user.findMany({
            where: {
                subscriptionEnd: {
                    not: null,
                    lte: inDays14.toJSDate(),
                    gt: now,
                },
            },
            include: {
                userSubscriptions: {
                    where: { pending: false, cancelled: false },
                    orderBy: { createdAt: "desc" },
                    take: 1,
                },
            },
        });

    for (const user of dbUserWithSubscriptionAboutToExpire) {
        if (user.userSubscriptions.length === 0) {
            continue;
        }

        const latestUserSubscription = user.userSubscriptions[0];
        if (
            latestUserSubscription.newSubscriptionEnd?.getTime() !=
                user.subscriptionEnd?.getTime() ||
            latestUserSubscription.newSubscriptionEnd == null
        ) {
            continue; // Should not happen.
        }

        if (
            latestUserSubscription.expirationReminder14 != null &&
            latestUserSubscription.expirationReminder7 != null &&
            latestUserSubscription.expirationReminder3 != null &&
            latestUserSubscription.expirationReminder1 != null
        ) {
            continue; // All reminders were sent. Nothing to do here.
        }

        if (
            latestUserSubscription.newSubscriptionEnd.getTime() <=
                inDays14.toJSDate().getTime() &&
            latestUserSubscription.newSubscriptionEnd.getTime() >
                inDays7.toJSDate().getTime()
        ) {
            // Situation: Days14
            if (latestUserSubscription.expirationReminder14 !== null) {
                continue; // Already notified.
            }

            log(`Notify account '${user.pubkey}': 14 days remaining.`);
            const relevantUserRelays = await determineRelevantRelays(user.id);
            await Nip05NostrService.instance.sendDMFromBot(
                user.pubkey,
                relevantUserRelays,
                message_14DaysLeft
            );

            await PrismaService.instance.db.userSubscription.update({
                where: { id: latestUserSubscription.id },
                data: { expirationReminder14: now },
            });
            await sleep(1000); // Just to be sure to not stress the relays.
            continue;
        } else if (
            latestUserSubscription.newSubscriptionEnd.getTime() <=
                inDays7.toJSDate().getTime() &&
            latestUserSubscription.newSubscriptionEnd.getTime() >
                inDays3.toJSDate().getTime()
        ) {
            // Situation: Days7
            if (latestUserSubscription.expirationReminder7 !== null) {
                continue; // Already notified.
            }

            log(`Notify account '${user.pubkey}': 7 days remaining.`);
            const relevantUserRelays = await determineRelevantRelays(user.id);
            await Nip05NostrService.instance.sendDMFromBot(
                user.pubkey,
                relevantUserRelays,
                message_7DaysLeft
            );
            await PrismaService.instance.db.userSubscription.update({
                where: { id: latestUserSubscription.id },
                data: { expirationReminder7: now },
            });
            await sleep(1000); // Just to be sure to not stress the relays.
            continue;
        } else if (
            latestUserSubscription.newSubscriptionEnd.getTime() <=
                inDays3.toJSDate().getTime() &&
            latestUserSubscription.newSubscriptionEnd.getTime() >
                inDays1.toJSDate().getTime()
        ) {
            // Situation: Days3
            if (latestUserSubscription.expirationReminder3 !== null) {
                continue; // Already notified.
            }

            log(`Notify account '${user.pubkey}': 3 days remaining.`);
            const relevantUserRelays = await determineRelevantRelays(user.id);
            const publishedRelays =
                await Nip05NostrService.instance.sendDMFromBot(
                    user.pubkey,
                    relevantUserRelays,
                    message_3DaysLeft
                );
            log(`Notified on relays: ${publishedRelays.join(", ")}`);
            await PrismaService.instance.db.userSubscription.update({
                where: { id: latestUserSubscription.id },
                data: { expirationReminder3: now },
            });
            await sleep(1000); // Just to be sure to not stress the relays.
            continue;
        } else {
            // Situation: Day1
            if (latestUserSubscription.expirationReminder1 !== null) {
                continue; // Already notified.
            }

            log(`Notify account '${user.pubkey}': 1 day remaining.`);
            const relevantUserRelays = await determineRelevantRelays(user.id);
            await Nip05NostrService.instance.sendDMFromBot(
                user.pubkey,
                relevantUserRelays,
                message_1DaysLeft
            );
            await PrismaService.instance.db.userSubscription.update({
                where: { id: latestUserSubscription.id },
                data: { expirationReminder1: now },
            });
            await sleep(1000); // Just to be sure to not stress the relays.
            continue;
        }
    }
};

const determineRelevantRelays = async function (
    userId: string
): Promise<string[]> {
    const relays = new Set<string>();

    const dbData = await PrismaService.instance.db.registration.findMany({
        where: { userId },
        select: { registrationRelays: true },
    });

    for (const data of dbData) {
        data.registrationRelays
            .map((x) => x.address)
            .forEach((y) => relays.add(y));
    }

    return Array.from(relays);
};

