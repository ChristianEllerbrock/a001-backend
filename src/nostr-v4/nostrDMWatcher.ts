import { Event, Filter, Relay, Sub, relayInit } from "nostr-tools";
import { Nip65RelayList } from "./type-defs";

// class RelayHealth {
//     startedAt = new Date();
//     connects :Date[] = []
//     disconnects: Date[] = [];
//     failedConnects:

//     constructor(public relayUrl: string){}
// }

export class NostrDMWatcher {
    #onDMCb!: (event: Event) => void | Promise<void>;
    #relays = new Map<string, Relay>();
    #relayPubkeys = new Map<string, Set<string>>();
    #relaySubscription = new Map<string, Sub>();
    #isDebugOn: boolean = true;

    #isOnDMCbSet = false;
    #relayCallbacksDISCONNECT = new Map<string, () => void>();
    #relayCallbacksERROR = new Map<string, () => void>();

    onDM(cb: (event: Event) => void | Promise<void>) {
        this.#onDMCb = cb;
        this.#isOnDMCbSet = true;
    }

    debug(on: boolean) {
        this.#isDebugOn = on;
    }

    /**
     *
     * @param data string: relayUrl, Set<string>: list of pubkeys
     */
    async watch(data: [string, Set<string>]) {
        if (!this.#isOnDMCbSet) {
            throw new Error("Error, you need to call 'onDM' first.");
        }

        const relay = await this.#ensureRelay(data[0]);

        // Store the pubkeys for the relay.
        let relayPubkeys = this.#relayPubkeys.get(data[0]);
        if (typeof relayPubkeys === "undefined") {
            this.#relayPubkeys.set(data[0], data[1]);
        } else {
            for (const pubkey of data[1]) {
                relayPubkeys.add(pubkey);
            }
        }

        this.#enableKeepAlive(relay);
        this.#subscribeOnRelay(relay);
    }

    async publishEvent(event: Event, onRelays?: string[]) {
        const relevantRelays =
            typeof onRelays === "undefined"
                ? Array.from(this.#relays.keys())
                : onRelays;

        const relays: Relay[] = [];
        for (const url of relevantRelays) {
            try {
                const relay = await this.#ensureRelay(url);
                relays.push(relay);
            } catch (error) {
                // Continue
                this.#log(`Error trying to publish to relay '${url}'`);
            }
        }

        const pubs = relays.map((x) => x.publish(event));
        await Promise.all(pubs);
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

    async #ensureRelay(url: string): Promise<Relay> {
        let relay = this.#relays.get(url);
        let isNewRelay = false;
        if (!relay) {
            relay = relayInit(url);
            isNewRelay = true;
        }

        await relay.connect();

        if (isNewRelay) {
            // Only add relay if it is new AND the connection was successful.
            this.#relays.set(url, relay);
        }
        return relay;
    }

    #enableKeepAlive(relay: Relay) {
        // Cleanup old callbacks.
        const oldDisconnectCb = this.#relayCallbacksDISCONNECT.get(relay.url);
        if (!oldDisconnectCb) {
            const disconnectCb = () => {
                this.#log(`DISCONNECT received on relay '${relay.url}'`);
            };
            relay.on("disconnect", disconnectCb);
            this.#relayCallbacksDISCONNECT.set(relay.url, disconnectCb);
        }

        const oldErrorCb = this.#relayCallbacksERROR.get(relay.url);
        if (!oldErrorCb) {
            const errorCb = () => {
                this.#log(`ERROR received on relay '${relay.url}'`);
            };
            relay.on("error", errorCb);
            this.#relayCallbacksERROR.set(relay.url, errorCb);
        }
    }

    #subscribeOnRelay(relay: Relay) {
        const pubkeys = this.#relayPubkeys.get(relay.url);
        if (typeof pubkeys === "undefined" || pubkeys.size === 0) {
            this.#log(`No pubkeys to subscribe to for relay '${relay.url}'`);
            return;
        }

        const relaySub = this.#relaySubscription.get(relay.url);
        if (relaySub) {
            // Cleanup.
            relaySub.off("event", this.#onDMCb);
            relaySub.unsub(); // Will probably fail.
        }

        const filter: Filter = {
            kinds: [4],
            "#p": Array.from(pubkeys),
            since: Math.floor(new Date().getTime() / 1000) - 150,
        };

        const sub = relay.sub([filter]);

        this.#relaySubscription.set(relay.url, sub);
        sub.on("event", this.#onDMCb);
    }

    async #fetchRelayEvents(
        filters: Filter[],
        onRelays?: string[]
    ): Promise<Event[]> {
        const relevantRelays =
            typeof onRelays === "undefined"
                ? Array.from(this.#relays.keys())
                : onRelays;

        const relays: Relay[] = [];
        for (const url of relevantRelays) {
            try {
                const relay = await this.#ensureRelay(url);
                relays.push(relay);
            } catch (error) {
                // Continue
                this.#log(
                    `Error trying to fetch relay event on relay '${url}'`
                );
            }
        }

        const lists = relays.map((x) => x.list(filters));
        const relayEventsArray = await Promise.all(lists);

        const events = new Map<string, Event>();
        for (const relayEvents of relayEventsArray) {
            relayEvents.forEach((x) => events.set(x.id, x));
        }

        return Array.from(events.values());
    }

    #log(text: string) {
        if (!this.#isDebugOn) {
            return;
        }
        console.log(`NostrDMWatcher : ${text}`);
    }
}

