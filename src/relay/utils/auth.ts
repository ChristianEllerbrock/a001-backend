import { Event, validateEvent, verifySignature } from "nostr-tools";
import { RelayAllowedService } from "../services/relay-allowed-service";

export const auth = function (
    authEvent: Event,
    conditions: {
        challenge: string;
        relayUrl: string;
    }
): [boolean, string] {
    const isSignatureOk = verifySignature(authEvent);
    if (!isSignatureOk) {
        return [false, "Auth event has invalid signature"];
    }

    if (authEvent.kind !== 22242) {
        return [false, "Auth event is not of kind 22242"];
    }

    if (authEvent.tags.length < 2) {
        return [false, "Auth event should have at least 2 tags"];
    }

    let authEventRelay: string | undefined;
    let authEventChallenge: string | undefined;
    for (const tag of authEvent.tags) {
        if (tag[0] === "relay") {
            authEventRelay = tag[1];
        } else if (tag[0] === "challenge") {
            authEventChallenge = tag[1];
        }
    }

    if (
        !authEventRelay
            ?.toLowerCase()
            .includes(conditions.relayUrl.replace("wss://", "").toLowerCase())
    ) {
        return [
            false,
            "Auth event relay tag does not provide the correct relay url",
        ];
    }

    if (authEventChallenge !== conditions.challenge) {
        return [false, "Auth event challenge tag does not match"];
    }

    const authEventCreatedAt = new Date(authEvent.created_at * 1000).getTime();
    const nowMinus10 = Date.now() - 1000 * 60 * 10;
    const nowPlus10 = Date.now() + 1000 * 60 * 10;
    if (authEventCreatedAt < nowMinus10 || authEventCreatedAt > nowPlus10) {
        return [false, "Auth event created_at not reasonable"];
    }

    // Last check: pubkey is a valid NIP05.social user.
    if (!RelayAllowedService.instance.pubkeys_auth.has(authEvent.pubkey)) {
        return [false, "Auth event pubkey is not in allowed list"];
    }

    return [true, "Auth ok."];
};

