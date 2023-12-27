import { RegistrationEmailIn } from "@prisma/client";
import { NostrConnector } from "../../nostr-v4/nostrConnector";
import { log } from "./common";
import { Nip05NostrService } from "../../services/nip05-nostr/nip05-nostr-service";

export const checkEmailInSubscriptionAndRespondIfNecessary = async function (
    maxNoOfEmailInPerMonth: number,
    dbRegistrationEmailIns: RegistrationEmailIn[],
    emailInMirrorConnector: NostrConnector,
    receiverPubkey: string,
    receiverInitialRelays: string[]
): Promise<boolean> {
    if (maxNoOfEmailInPerMonth === -1) {
        // The user's subscription allows unlimited email ins.
        log("Subscription check: ok (unlimited).");
        return true;
    }

    if (maxNoOfEmailInPerMonth === 0) {
        // The user's subscription does not cover EMAIL IN at all.
        const relevantRelays =
            await Nip05NostrService.instance.includeNip65Relays(
                receiverPubkey,
                receiverInitialRelays
            );

        log(
            "Subscription check: failed (subscription does not cover EMAIL IN). Respond with DM."
        );
        const text =
            "== MESSAGE FROM NIP05.social\n\n" +
            "We have received an email for you but your current subscription does not include INBOUND EMAIL FORWARDING. " +
            "Please subscribe to a higher plan on\n\n" +
            "https://nip05.social";

        await Nip05NostrService.instance.sendDM(
            emailInMirrorConnector,
            receiverPubkey,
            relevantRelays,
            text
        );

        return false;
    }

    // The user's subscription generally covers EMAIL IN.
    // Let's check if he still has a contingent.

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const noOfEmailInThisMonth = dbRegistrationEmailIns
        .filter((x) => {
            return x.date.getFullYear() === year && x.date.getMonth() === month;
        })
        .sum((x) => x.total);

    if (noOfEmailInThisMonth >= maxNoOfEmailInPerMonth) {
        // The user has spent his contingent for this month.

        const relevantRelays =
            await Nip05NostrService.instance.includeNip65Relays(
                receiverPubkey,
                receiverInitialRelays
            );

        log(
            `Subscription check: failed (contingent of ${maxNoOfEmailInPerMonth} exhausted). Respond with DM.`
        );
        const text =
            "== MESSAGE FROM NIP05.social\n\n" +
            "We have received an email for you, but you already have exhausted your " +
            `allowed number of inbound emails this month (${maxNoOfEmailInPerMonth}).\n\n` +
            "You can receive inbound emails again starting next month. You can also subscribe to a higher plan on\n\n" +
            "https://nip05.social";

        await Nip05NostrService.instance.sendDM(
            emailInMirrorConnector,
            receiverPubkey,
            relevantRelays,
            text
        );

        return false;
    }

    // The use still has a contingent for EMAIL INs.
    log(
        `Subscription check: ok (spent ${noOfEmailInThisMonth} of ${maxNoOfEmailInPerMonth} this month).`
    );

    return true;
};

