import { DateTime } from "luxon";
import { Event } from "nostr-tools";

export const log = function (event: Event | undefined, text: string) {
    const id =
        typeof event === "undefined" ? "system" : event.id.substring(0, 10);
    console.log(`EMAIL OUT - [${id}] - ${text}`);
};

export const determineNextPeriodStart = function (
    subscriptionEnd: Date | undefined | null
): DateTime | undefined {
    if (!subscriptionEnd) {
        return undefined;
    }

    const now = new Date();
    if (subscriptionEnd.getTime() < now.getTime()) {
        return undefined; // Subscription already has ended.
    }

    let movingDateTime = DateTime.fromJSDate(subscriptionEnd);
    do {
        movingDateTime = movingDateTime.plus({ days: -30 });
    } while (movingDateTime.toJSDate().getTime() > now.getTime());

    const nextPeriodStart = movingDateTime.plus({ days: 30 });
    if (nextPeriodStart.toJSDate().getTime() > subscriptionEnd.getTime()) {
        return undefined; // The next period is after subscription end.
    }

    return nextPeriodStart;
};

