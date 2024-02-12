import { Event, Filter, Relay } from "nostr-tools";
import { Nip65RelayList } from "./type-defs";
import { NostrDMWatcherDoctor } from "./nostrDMWatcherDoctor";
import { OPEN, WebSocket } from "ws";
import { DateTime } from "luxon";
import "../nostr-v4/arrayExtensions";

export type NostrDMWatcherRelayInfo = {
    url: string;
    status: string;
    watchedPubkeys: string[];
    noOfDisconnects: number;
    averageTimeBetweenDisconnects: string;
    averageUptime: string;
};

export class NostrDMWatcher {
    #onDMCb!: (event: Event) => void | Promise<void>;
    #relays = new Map<string, Relay>();
    #relayPubkeys = new Map<string, Set<string>>();
    //#relaySubscription = new Map<string, Sub>();
    #isDebugOn: boolean = true;

    #isOnDMCbSet = false;
    #relayCallbacksDISCONNECT = new Map<string, () => void>();
    #relayCallbacksERROR = new Map<string, () => void>();
    #relayCallbacksCONNECT = new Map<string, () => void>();
    #relayCallbacksNOTICE = new Map<string, (msg: string) => void>();

    public doctor = new NostrDMWatcherDoctor(this.#isDebugOn);

    onDM(cb: (event: Event) => void | Promise<void>) {
        this.#onDMCb = cb;
        this.#isOnDMCbSet = true;
    }

    debug(on: boolean) {
        this.#isDebugOn = on;
        this.doctor.setDebug(on);
    }

    getRelayInfos(): NostrDMWatcherRelayInfo[] {
        const infos: NostrDMWatcherRelayInfo[] = [];

        const relayPatients = this.doctor.getPatientInfos();

        for (const relay of this.#relays) {
            const watchedPubkeys = this.#relayPubkeys.get(relay[0]);
            const status = this.#getRelayStatus(relay[1]);
            let averageTimeBetweenDisconnects = "-";
            let averageUptime = "-";
            const relayPatient = relayPatients.get(relay[0]);
            if (relayPatient) {
                // Calculate averageTimeBetweenDisconnects
                averageTimeBetweenDisconnects =
                    this.#calculateAverageTimeBetween(
                        relayPatient.timesBetweenDisconnects
                    );
                averageUptime = this.#calculateAverageTime(
                    relayPatient.uptimesInSeconds
                );
            }

            infos.push({
                url: relay[0],
                status,
                watchedPubkeys:
                    typeof watchedPubkeys === "undefined"
                        ? []
                        : Array.from(watchedPubkeys),
                noOfDisconnects: relayPatient?.noOfDisconnects ?? 0,
                averageTimeBetweenDisconnects,
                averageUptime,
            });
        }

        return infos;
    }

    /** For testing purposes only. */
    killRandomRelayConnection() {
        this.#log(
            `Testing: Trying to find a random OPEN relay (of the current ${
                this.#relays.size
            } relays) and kill it. `
        );
        const relays = Array.from(this.#relays.values()).filter(
            (x) => x.connected
        );

        if (relays.length === 0) {
            // No relay is only. Nothing to kill here.
            this.#log(`Testing: Found no OPEN relay.`);
            return;
        }

        // Returns a random integer from 0 to 100:
        const killIndex = Math.floor(Math.random() * relays.length);
        this.#log(`Testing: Will try to kill '${relays[killIndex].url}'`);

        // Sending close WILL NOT WORK as this removes all listeners.
        // Have to think about another way.
        //relays[killIndex].close();
        //this.#doctor.cure(relays[killIndex]);
    }

    /**
     *
     * @param data string: relayUrl, Set<string>: list of pubkeys
     */
    // async watch(data: [string, Set<string>]) {
    //     if (!this.#isOnDMCbSet) {
    //         throw new Error("Error, you need to call 'onDM' first.");
    //     }

    //     const relay = await this.#ensureRelay(data[0]);

    //     // Store the pubkeys for the relay.
    //     let relayPubkeys = this.#relayPubkeys.get(data[0]);
    //     if (typeof relayPubkeys === "undefined") {
    //         this.#relayPubkeys.set(data[0], data[1]);
    //     } else {
    //         for (const pubkey of data[1]) {
    //             relayPubkeys.add(pubkey);
    //         }
    //     }

    //     this.#enableKeepAlive(relay);
    //     this.#subscribeOnRelay(relay);
    // }

    async publishEvent(event: Event, onRelays?: string[]): Promise<string[]> {
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

        const publishedOn: string[] = [];

        const pubs = relays.map((x) => this.#publish(x, event));
        const promiseResults = await Promise.allSettled(pubs);

        for (const result of promiseResults) {
            if (result.status === "fulfilled") {
                publishedOn.push(result.value);
            } else {
                console.log(result.reason);
            }
        }

        return publishedOn;
    }

    #publish(relay: Relay, event: Event): Promise<string> {
        return new Promise((resolve, reject) => {
            relay
                .publish(event)
                .then(() => {
                    resolve(relay.url);
                })
                .catch((error) => {
                    reject(
                        `[NostrDMWatcher] - Publish Error (Kind ${event.kind}) : ${relay.url} - ${error}`
                    );
                });
        });
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

    #ensureRelay(
        url: string,
        timeout: number | undefined = 2500
    ): Promise<Relay> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject("Timeout");
            }, timeout);

            let relay = this.#relays.get(url);
            if (!relay) {
                relay = new Relay(url);

                this.#relays.set(url, relay);
            }

            relay
                .connect()
                .then(() => {
                    clearTimeout(timer);

                    resolve(relay as Relay);
                    return;
                })
                .catch((error) => {
                    clearTimeout(timer);
                    reject("Could not connect to relay");
                    return;
                });
        });
    }

    // #enableKeepAlive(relay: Relay) {
    //     // Cleanup old callbacks.
    //     const oldDisconnectCb = this.#relayCallbacksDISCONNECT.get(relay.url);
    //     if (!oldDisconnectCb) {
    //         const disconnectCb = () => {
    //             this.#log(
    //                 `DISCONNECT received on relay '${relay.url}'. Cure relay.`
    //             );
    //             this.doctor.cure(relay, () => {
    //                 this.#subscribeOnRelay(relay);
    //             });
    //         };
    //         relay.onclose = disconnectCb;
    //         this.#relayCallbacksDISCONNECT.set(relay.url, disconnectCb);
    //     }

    //     const oldErrorCb = this.#relayCallbacksERROR.get(relay.url);
    //     if (!oldErrorCb) {
    //         const errorCb = () => {
    //             this.#log(`ERROR received on relay '${relay.url}'`);
    //         };
    //         relay.on("error", errorCb);
    //         this.#relayCallbacksERROR.set(relay.url, errorCb);
    //     }

    //     const oldConnectCb = this.#relayCallbacksCONNECT.get(relay.url);
    //     if (!oldConnectCb) {
    //         const connectCb = () => {
    //             this.#log(`CONNECT received on relay '${relay.url}'`);
    //         };
    //         relay.on("connect", connectCb);
    //         this.#relayCallbacksCONNECT.set(relay.url, connectCb);
    //     }

    //     const oldNoticeCb = this.#relayCallbacksNOTICE.get(relay.url);
    //     if (!oldNoticeCb) {
    //         const noticeCb = (msg: string) => {
    //             this.#log(`NOTICE received on relay '${relay.url}': ${msg}`);
    //         };
    //         relay.on("notice", noticeCb);
    //         this.#relayCallbacksNOTICE.set(relay.url, noticeCb);
    //     }
    // }

    // #subscribeOnRelay(relay: Relay) {
    //     const pubkeys = this.#relayPubkeys.get(relay.url);
    //     if (typeof pubkeys === "undefined" || pubkeys.size === 0) {
    //         this.#log(`No pubkeys to subscribe to for relay '${relay.url}'`);
    //         return;
    //     }

    //     const relaySub = this.#relaySubscription.get(relay.url);
    //     if (relaySub) {
    //         // Cleanup.
    //         relaySub.off("event", this.#onDMCb);
    //         relaySub.unsub(); // Will probably fail.
    //     }

    //     const filter: Filter = {
    //         kinds: [4],
    //         "#p": Array.from(pubkeys),
    //         since: Math.floor(new Date().getTime() / 1000) - 150,
    //     };

    //     this.#log(
    //         `Subscribe to DMs for ${pubkeys.size} pubkeys on relay '${relay.url}'`
    //     );
    //     const sub = relay.sub([filter]);

    //     this.#relaySubscription.set(relay.url, sub);
    //     sub.on("event", this.#onDMCb);
    // }

    async #fetchRelayEvents(
        filters: Filter[],
        onRelays?: string[]
    ): Promise<Event[]> {
        if (typeof onRelays === "undefined") {
            return [];
        }

        const debug = false;

        const promises = onRelays.map((x) => {
            return new Promise<Event[]>((resolve, reject) => {
                const start = DateTime.now();
                this.#ensureRelay(x)
                    .then((relay) => {
                        const diff = start
                            .diffNow("seconds")
                            .toObject()
                            .seconds?.toFixed(1);

                        if (debug) {
                            this.#log(`ok: ${diff} seconds`);
                        }

                        const events: Event[] = [];
                        const sub = relay.subscribe(filters, {
                            onevent(event) {
                                events.push(event);
                            },
                            oneose() {
                                sub.close();
                                resolve(events);
                                return;
                            },
                            onclose(reason) {
                                resolve(events);
                                return;
                            },
                        });
                    })
                    .catch((error) => {
                        const diff = start
                            .diffNow("seconds")
                            .toObject()
                            .seconds?.toFixed(1);

                        if (debug) {
                            this.#log(`notok: ${diff} seconds`);
                        }

                        reject(`${x} - ${error}`);
                        return;
                    });
            });
        });

        const events = new Map<string, Event>();

        const relayEventsArray = await Promise.allSettled(promises);

        for (const promiseResult of relayEventsArray) {
            if (promiseResult.status === "fulfilled") {
                promiseResult.value.forEach((x) => events.set(x.id, x));
            } else {
                this.#log(`${promiseResult.reason}`);
            }
        }

        return Array.from(events.values());
    }

    #log(text: string) {
        if (!this.#isDebugOn) {
            return;
        }
        console.log(`NostrDMWatcher : ${text}`);
    }

    #getRelayStatus(relay: Relay): string {
        return relay.connected ? "OPEN" : "NOT OPEN";
    }

    #calculateAverageTimeBetween(times: Date[]): string {
        if (times.length < 2) {
            return "-";
        }

        const sortedTimes = times.sortBy((x) => x.getTime(), "asc");
        const timeBetweenInSeconds: number[] = [];

        let lastTime: Date | undefined;
        for (const time of sortedTimes) {
            if (typeof lastTime === "undefined") {
                lastTime = time;
                continue;
            }

            const diff = DateTime.fromJSDate(time)
                .diff(DateTime.fromJSDate(lastTime), "seconds")
                .toObject().seconds;
            if (diff) {
                timeBetweenInSeconds.push(diff);
            }
        }

        return this.#calculateAverageTime(timeBetweenInSeconds);
    }

    #calculateAverageTime(seconds: number[]): string {
        const averageTimeInSeconds = seconds.sum((x) => x) / seconds.length;

        if (averageTimeInSeconds <= 60) {
            return averageTimeInSeconds.toFixed(2) + " seconds";
        }

        if (averageTimeInSeconds <= 60 * 60) {
            return (averageTimeInSeconds / 60).toFixed(2) + " minutes";
        }

        if (averageTimeInSeconds <= 60 * 60 * 24) {
            return (averageTimeInSeconds / (60 * 60)).toFixed(2) + " hours";
        }

        return (averageTimeInSeconds / (60 * 60 * 24)).toFixed(2) + " days";
    }
}

