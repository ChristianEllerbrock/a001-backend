import { Event, Filter, Relay, SimplePool } from "nostr-tools";
import { Nip65RelayList } from "./type-defs";

export class NostrPoolRelayer {
    #relays = new Map<string, Relay>();
    readonly #pool: SimplePool;

    constructor() {
        this.#pool = new SimplePool();
    }

    async tryAddRelays(poolRelays: string[]): Promise<Relay[]> {
        const relays: Relay[] = [];

        for (const poolRelay of poolRelays) {
            if (this.#relays.has(poolRelay)) {
                continue;
            }

            try {
                const relay = await this.#pool.ensureRelay(poolRelay);
                relays.push(relay);

                this.#relays.set(relay.url, relay);
            } catch (error) {
                console.log(error);
            }
        }

        return relays;
    }

    async ensureRelay(relayUrl: string): Promise<Relay> {
        const relay = await this.#pool.ensureRelay(relayUrl);
        this.#relays.set(relay.url, relay);
        return relay;
    }

    async kind4MonitorOn(
        pubkeys: string[],
        onEvent: (event: Event) => Promise<void>,
        startXSecondsInThePast: number = 0
    ) {
        const filters: Filter = {
            kinds: [4],
            "#p": pubkeys,
            since:
                Math.floor(new Date().getTime() / 1000) -
                startXSecondsInThePast,
        };

        const sub = this.#pool.sub(Array.from(this.#relays.keys()), [filters]);
        sub.on("event", async (event) => {
            await onEvent(event);
        });

        return this.#pool;
    }

    async fetchNip65RelayLists(
        pubkey: string,
        onRelays?: string[]
    ): Promise<Nip65RelayList[]> {
        const event = await this.fetchReplaceableEvent(
            pubkey,
            [10002],
            onRelays
        );
        if (!event) {
            return [];
        }

        const nip65RelayList: Nip65RelayList[] = [];
        for (let tag of event.tags ?? []) {
            if (tag[0] !== "r") {
                continue;
            }

            const url = tag[1];
            const operation = tag[2] as string | undefined;

            if (typeof operation === "undefined") {
                nip65RelayList.push({
                    url,
                    operation: "read+write",
                });
            } else if (operation === "read" || operation === "write") {
                nip65RelayList.push({
                    url,
                    operation,
                });
            }
        }
        return nip65RelayList;
    }

    async fetchReplaceableEvent(
        pubkey: string,
        kinds: number[],
        onRelays?: string[]
    ): Promise<Event | undefined> {
        if (kinds.find((x) => (x < 10000 && x != 0 && x != 3) || x > 19999)) {
            throw new Error("WRONG KINDS");
        }

        const eventFilters: Filter[] = [
            {
                kinds,
                authors: [pubkey],
            },
            {
                kinds: [5],
                authors: [pubkey],
                "#a": kinds.map((x) => `${x}:${pubkey}`),
            },
        ];

        const allEvents = await this.#fetchRelayEvents(eventFilters, onRelays);

        const latestRegularEvent = Array.from(allEvents)
            .filter((x) => x.kind !== 5)
            .sortBy((x) => x.created_at, "desc")
            .shift();

        if (typeof latestRegularEvent === "undefined") {
            return undefined;
        }

        const latestDeletionEvent = Array.from(allEvents)
            .filter((x) => x.kind === 5)
            .sortBy((x) => x.created_at, "desc")
            .shift();

        if (typeof latestDeletionEvent === "undefined") {
            return latestRegularEvent;
        }

        return latestDeletionEvent.created_at > latestRegularEvent.created_at
            ? undefined
            : latestRegularEvent;
    }

    async publishEvent(event: Event, onRelays?: string[]) {
        const relevantRelays =
            typeof onRelays === "undefined"
                ? Array.from(this.#relays.keys())
                : onRelays;

        const pubs = this.#pool.publish(relevantRelays, event);
        await Promise.all(pubs);
    }

    async #fetchRelayEvents(filters: Filter[], onRelays?: string[]) {
        const relevantRelays =
            typeof onRelays === "undefined"
                ? Array.from(this.#relays.keys())
                : onRelays;
        return await this.#pool.list(relevantRelays, filters);
    }
}

