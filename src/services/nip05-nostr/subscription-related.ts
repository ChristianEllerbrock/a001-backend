import { DateTime } from "luxon";
import { Nip05NostrService } from "./nip05-nostr-service";
import { PrismaService } from "../prisma-service";
import { NostrConnector } from "../../nostr-v4/nostrConnector";
import { Event } from "nostr-tools";
import { determineNextPeriodStart, log } from "./common";

export const checkSubscriptionAndRespondIfNecessary = async function (
    this: Nip05NostrService,
    event: Event,
    dbUser: DbUser,
    receiverConnector: NostrConnector,
    senderInitialRelays: string[]
): Promise<boolean> {
    const maxNoOfOutboundEmailsPerMonth =
        dbUser.subscription.maxNoOfOutboundEmailsPer30Days;

    let checkResult: number | undefined;

    if (maxNoOfOutboundEmailsPerMonth === -1) {
        checkResult = -1;
    } else if (maxNoOfOutboundEmailsPerMonth === 0) {
        checkResult = undefined;
    } else {
        const now = DateTime.now();
        if (
            !dbUser.subscriptionEnd ||
            dbUser.subscriptionEnd.getTime() < now.toJSDate().getTime()
        ) {
            checkResult = undefined;
        } else {
            // We now have to check whether user user already has
            // exhausted his limits.
            let endDateTime = DateTime.fromJSDate(dbUser.subscriptionEnd);
            do {
                endDateTime = endDateTime.plus({ days: -30 });
            } while (
                endDateTime.toJSDate().getTime() > now.toJSDate().getTime()
            );

            const checkStart = endDateTime
                .plus({ days: 1 })
                .startOf("day")
                .toJSDate();

            const dbOutsInCurrentPeriod =
                await PrismaService.instance.db.registrationEmailOut.findMany({
                    include: {
                        registration: true,
                    },
                    where: {
                        date: { gte: checkStart },
                        registration: {
                            userId: dbUser.id,
                        },
                    },
                });

            const outsInCurrentPeriod = dbOutsInCurrentPeriod
                .map((x) => x.total)
                .reduce((accumulator, currentValue) => {
                    return accumulator + currentValue;
                }, 0);

            checkResult = maxNoOfOutboundEmailsPerMonth - outsInCurrentPeriod;
        }
    }

    log(
        event,
        "Subscription check (for user's 30-day-period): " +
            checkResult +
            " for " +
            event.pubkey
    );

    // Handle the response (if necessary).
    if (typeof checkResult === "undefined") {
        // The user's subscription does NOT cover EMAIL OUT
        // TODO: Answer DM
        const relevantRelays = await this.includeNip65Relays(
            event.pubkey,
            senderInitialRelays
        );
        log(
            event,
            `Respond with DM: The user's subscription does NOT cover EMAIL OUT. Publish on ${relevantRelays.join(
                ", "
            )}`
        );
        let text =
            "ATTENTION: NIP05.social\n\n" +
            "Your current subscription does not include OUTBOUND EMAIL FORWARDING. " +
            "Please subscribe to a higher plan on\n\n" +
            "https://nip05.social";

        await this.sendDM(
            receiverConnector,
            event.pubkey,
            relevantRelays,
            text
        );
        log(event, "Done");

        return false;
    } else if (checkResult === 0) {
        // The user has exhausted his contingent in this 30-day-period.
        const relevantRelays = await this.includeNip65Relays(
            event.pubkey,
            senderInitialRelays
        );
        log(
            event,
            `Respond with DM: The user has exhausted his contingent for EMAIL OUT. Publish on ${relevantRelays.join(
                ", "
            )}`
        );
        let text =
            "== MESSAGE FROM NIP05.social\n\n" +
            `You have exhausted your maximum number of allowed outbound emails per 30 day period (${dbUser.subscription.maxNoOfOutboundEmailsPer30Days}). `;

        // 2 Situations: No more next period or more next period(s)
        const nextPeriodStart = determineNextPeriodStart(
            dbUser.subscriptionEnd
        );

        if (nextPeriodStart) {
            text += `Please wait until the next period starts (at ${nextPeriodStart
                .toUTC()
                .toFormat(
                    "yyyy-MM-dd HH:mm"
                )} UTC), or subscribe to a higher plan on \n\n`;
            text += "https://nip05.social";
        } else {
            text += `Your subscription ends at ${DateTime.fromJSDate(
                dbUser.subscriptionEnd ?? new Date()
            )
                .toUTC()
                .toFormat(
                    "yyyy-MM-dd HH:mm"
                )} (UTC). Please consider prolonging your subscription on\n\n`;
            text += "https://nip05.social";
        }

        await this.sendDM(
            receiverConnector,
            event.pubkey,
            relevantRelays,
            text
        );

        log(event, "Done");

        return false;
    }

    return true;
};

