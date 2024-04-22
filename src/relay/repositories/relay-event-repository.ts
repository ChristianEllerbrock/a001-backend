import { Event, Filter } from "nostr-tools";
import {
    EventMeaning,
    getEventDTagValue,
    getEventMeaning,
} from "../utils/event";
import { RMService } from "../../services/redis-memory-service";
import { R_RelayEvent } from "../../types/redis/@types";
import { RedisMemoryCollectionType } from "../../common/redis-memory/redis-memory-type";
import { createLogger } from "../utils/common";
const debug = createLogger("[Relay] - RelayEventRepository");

export class RelayEventRepository {
    // #region Singleton
    static #instance: RelayEventRepository;

    static get instance() {
        if (this.#instance) {
            return this.#instance;
        }

        this.#instance = new RelayEventRepository();
        return this.#instance;
    }

    // #endregion Singleton

    /**
     * Creates the event in the database. Returns "-1" if the event
     * already exists and "1" if it is new.
     *
     * This method is intended for RegularEvents.
     */
    async create(event: Event): Promise<number> {
        // Check, if the eventId already exists.
        const exists = await RMService.i.relayEvent.exists(event.id);
        if (exists) {
            return -1;
        }

        // The event does not exist. Create it.
        await this.#create(event);
        return +1;
    }

    /**
     * Updates existing ReplaceableEvents or ParameterizedReplaceableEvents
     *
     * Returns "-1" if the database has a newer version. Returns "1" when
     * the event is newest and the database will be updated.
     *
     * This method is intended for ReplaceableEvents or ParameterizedReplaceableEvents.
     */
    async upsert(event: Event) {
        const meaning = getEventMeaning(event);
        if (
            [
                EventMeaning.ReplaceableEvent,
                EventMeaning.ParameterizedReplaceableEvent,
            ].includes(meaning)
        ) {
            throw new Error(
                `Cannot upsert the ${meaning} event in the database.`
            );
        }

        // Check, if the database holds any version.
        let erRelayEvent:
            | RedisMemoryCollectionType<R_RelayEvent>
            | null
            | undefined;

        if (meaning === EventMeaning.ReplaceableEvent) {
            // where: { kind: event.kind, pubkey: event.pubkey },
            const query =
                `@kind:[${event.kind} ${event.kind}]` +
                ` @pubkey:{${event.pubkey}}`;
            erRelayEvent = (await RMService.i.relayEvent.search(query))[0];
        } else {
            // ParameterizedReplaceableEvents
            const dTagValue = getEventDTagValue(event);
            if (!dTagValue) {
                throw new Error("Event does not have a 'd' tag value");
            }

            // where: {
            //     kind: event.kind,
            //     pubkey: event.pubkey,
            //     relayEventTags: {
            //         some: { name: "d", value: dTagValue },
            //     },
            // },
            const query =
                `@kind:[${event.kind} ${event.kind}]` +
                ` @pubkey:{${event.pubkey}}` +
                ` @d:{${dTagValue}}`;

            erRelayEvent = (await RMService.i.relayEvent.search(query))[0];
        }

        if (!erRelayEvent) {
            // The Redis database has no version at all. Insert the event into the database.
            await this.#create(event);
            return 1;
        }

        // We already have stored another version in the database.
        // Determine what to do.

        if (event.created_at > erRelayEvent.data.created_at) {
            // The event version is more recent.
            await this.#create(event);
            return 1;
        } else {
            // The database version is more recent.
            return -1;
        }
    }

    async findByFilters(filters: Filter[]): Promise<Event[]> {
        // filters are OR
        // filter conditions are AND

        const orArray: string[] = [];
        for (const filter of filters) {
            const andArray: string[] = [];

            if (typeof filter.ids !== "undefined") {
                andArray.push(`@id:{${filter.ids.join(" | ")}}`);
            }

            if (typeof filter.authors !== "undefined") {
                andArray.push(`@pubkey:{${filter.authors.join(" | ")}}`);
            }

            if (typeof filter.kinds !== "undefined") {
                if (filter.kinds.length === 1) {
                    andArray.push(
                        `@kind:[${filter.kinds[0]} ${filter.kinds[0]}]`
                    );
                } else {
                    let kindString = "( ";

                    kindString += filter.kinds
                        .map((x) => {
                            return `@kind:[${x} ${x}]`;
                        })
                        .join(" | ");

                    kindString += " )";
                    andArray.push(kindString);
                }
            }

            // Handle "created_at"
            if (filter.since || filter.until) {
                const start = filter.since ? filter.since.toString() : "-inf";
                const end = filter.until ? filter.until.toString() : "+inf";
                andArray.push(`@created_at:[${start} ${end}]`);
            }

            for (const key of Object.keys(filter)) {
                if (!key.includes("#") || key.length !== 2) {
                    continue;
                }

                // We have a "#" key (e.g. "#e" or "#p").
                let tagName = key;
                tagName = tagName.replace("#", "");
                const tagValues = filter[`#${tagName}`] ?? [];

                if (!tagValues.empty()) {
                    andArray.push(`@${tagName}:{${tagValues.join(" | ")}}`);
                }
            }

            const andString = "( " + andArray.join(" ") + " )";
            orArray.push(andString);
        }

        const queryString = orArray.join(" | ");

        const erRelayEvents = await RMService.i.relayEvent.search(queryString);
        console.log(`Filter returned ${erRelayEvents.length} events.`);
        return erRelayEvents.map((event) => this.#toNostrEvent(event));
    }

    /**
     * Deletes all references in the database of a NIP-05 delete event.
     * This method does NOT store the deletion event automatically.
     * This must be triggered separately by a call to "create".
     *
     * Illegal deletion requests (i.e. requests for another pubkey) will be ignored.
     */
    async delete(event: Event): Promise<void> {
        if (event.kind !== 5) {
            throw new Error("The event is not a kind 5 deletion event");
        }

        const eTagValues: string[] = [];
        const aTagValues: string[] = [];
        for (const tag of event.tags) {
            if (tag[0] === "e") {
                eTagValues.push(tag[1]);
            } else if (tag[0] === "a") {
                aTagValues.push(tag[1]);
            }
        }

        // Delete all e events IF THEY ARE FROM THE REQUESTER
        for (const e of eTagValues) {
            const erRelayEvent = await RMService.i.relayEvent.fetch(e);
            if (erRelayEvent?.data.pubkey === event.pubkey) {
                await erRelayEvent.remove();
            }
        }

        // Delete all a references IF THEY ARE FROM THE REQUESTER
        for (const aTagValue of aTagValues) {
            const [kind, pubkey, dValue] = aTagValue.split(":");

            if (event.pubkey !== pubkey) {
                continue; // Ignore illegal requests.
            }

            const query =
                `@kind:[${kind} ${kind}]` +
                ` @pubkey:{${pubkey}}` +
                ` @d:{${dValue}}`;

            const erRelayEvent = (
                await RMService.i.relayEvent.search(query)
            )[0];

            if (erRelayEvent) {
                await erRelayEvent.remove();
            }
        }
    }

    #toNostrEvent(
        erRelayEvent: RedisMemoryCollectionType<R_RelayEvent>
    ): Event {
        return {
            id: erRelayEvent.data.id,
            created_at: erRelayEvent.data.created_at,
            kind: erRelayEvent.data.kind,
            pubkey: erRelayEvent.data.pubkey,
            content: erRelayEvent.data.content,
            sig: erRelayEvent.data.sig,
            tags: erRelayEvent.data.tags,
        };
    }

    async #create(event: Event) {
        const rRelayEvent: R_RelayEvent = {
            ...event,
            _tags: this.#buildTagObject(event),
        };
        await RMService.i.relayEvent.save(event.id, rRelayEvent);
    }

    #buildTagObject(event: Event): { [key: string]: string } {
        const tagObject: { [key: string]: string } = {};
        for (const tag of event.tags) {
            tagObject[tag[0]] = tag[1];
        }

        return tagObject;
    }
}

