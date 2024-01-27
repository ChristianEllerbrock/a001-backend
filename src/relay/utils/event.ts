import { Event, Filter, validateEvent, verifyEvent } from "nostr-tools";
import { isGenericTagQuery } from "./filter";

/**
 * Returns a nostr-tools EVENT or throws an exception.
 */
export const toEvent = function (text: string): Event {
    return JSON.parse(text) as Event;
};

export enum EventMeaning {
    /**
     * kind n: 1000 <= n < 10,000
     *
     * All events are expected to be stored by relays.
     */
    RegularEvent = "RegularEvent",

    /**
     * kind n: 10,000 <= n < 20,000 || n == 0 || n == 3
     *
     * For each combination of `pubkey` and `kind`, ony the latest
     * event MUST be stored by relays. Older versions MAY be discarded.
     */
    ReplaceableEvent = "ReplaceableEvent",

    /**
     * kind n: 20,000 <= n < 30,000
     *
     * These events are NOT expected to be stored by relays.
     */
    EphemeralEvent = "EphemeralEvent",

    /**
     * kind n: 30000 <= n < 40000
     *
     * For each combination of `pubkey`, `kind` and the `d` tag's first
     * value, only the latest event MUST be stored by relays.
     * Older versions MAY be discarded.
     */
    ParameterizedReplaceableEvent = "ParameterizedReplaceableEvent",
}

export const getEventMeaning = (event: Event): EventMeaning => {
    if (event.kind === 0 || event.kind === 3) {
        return EventMeaning.ReplaceableEvent;
    }

    if (event.kind >= 1000 && event.kind < 10000) {
        return EventMeaning.RegularEvent;
    }

    if (event.kind >= 10000 && event.kind < 20000) {
        return EventMeaning.ReplaceableEvent;
    }

    if (event.kind >= 20000 && event.kind < 30000) {
        return EventMeaning.EphemeralEvent;
    }

    if (event.kind >= 30000 && event.kind < 40000) {
        return EventMeaning.ParameterizedReplaceableEvent;
    }

    return EventMeaning.RegularEvent;
};

export const getEventDTagValue = (event: Event): string | undefined => {
    let dTagValue: string | undefined;
    for (const tag of event.tags) {
        if (tag[0] !== "d") {
            continue;
        }

        dTagValue = tag[1];
        break;
    }
    return dTagValue;
};

export const isEventValid = async function (
    event: Event
): Promise<string | undefined> {
    const ok = verifyEvent(event);
    if (!ok) {
        return "invalid event";
    }
    return undefined;
};

export const isEventMatchingFilter =
    (filter: Filter) =>
    (event: Event): boolean => {
        const startsWith = (input: string) => (prefix: string) =>
            input.startsWith(prefix);

        // NIP-01: Basic protocol flow description

        if (
            Array.isArray(filter.ids) &&
            !filter.ids.some(startsWith(event.id))
        ) {
            return false;
        }

        if (Array.isArray(filter.kinds) && !filter.kinds.includes(event.kind)) {
            return false;
        }

        if (
            typeof filter.since === "number" &&
            event.created_at < filter.since
        ) {
            return false;
        }

        if (
            typeof filter.until === "number" &&
            event.created_at > filter.until
        ) {
            return false;
        }

        if (Array.isArray(filter.authors)) {
            if (!filter.authors.some(startsWith(event.pubkey))) {
                return false;
            }
        }

        // NIP-27: Multicast
        // const targetMulticastGroups: string[] = event.tags.reduce(
        //   (acc, tag) => (tag[0] === EventTags.Multicast)
        //     ? [...acc, tag[1]]
        //     : acc,
        //   [] as string[]
        // )

        // if (targetMulticastGroups.length && !Array.isArray(filter['#m'])) {
        //   return false
        // }

        // NIP-01: Support #e and #p tags
        // NIP-12: Support generic tag queries

        if (
            Object.entries(filter)
                .filter(
                    ([key, criteria]) =>
                        isGenericTagQuery(key) && Array.isArray(criteria)
                )
                .some(([key, criteria]) => {
                    return !event.tags.some(
                        (tag) =>
                            tag[0] === key[1] &&
                            (criteria as string[]).includes(tag[1])
                    );
                })
        ) {
            return false;
        }

        return true;
    };

