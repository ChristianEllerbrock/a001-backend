import { v4 } from "uuid";
import { NostrRelayer } from "../nostr-v4/nostrRelayer";
import { Nip65RelayList, RelayEvent } from "../nostr-v4/type-defs";

export class NostrRelayerService {
    static #instance: NostrRelayerService;
    static get instance(): NostrRelayerService {
        if (!this.#instance) {
            this.#instance = new NostrRelayerService();
        }

        return this.#instance;
    }

    relayer: NostrRelayer;

    constructor() {
        this.relayer = new NostrRelayer();
    }

    fetchRelayListForPubkey(
        pubkey: string,
        fromRelays: string[]
    ): Promise<Nip65RelayList[]> {
        return new Promise((resolve, reject) => {
            const channelId = v4();
            let receivedRelayEvents: RelayEvent[] = [];
            NostrRelayerService.instance.relayer.nostrPubSub.on(
                channelId,
                (eos: boolean, relayEvents: RelayEvent[]) => {
                    receivedRelayEvents.push(...relayEvents);

                    if (!eos) {
                        return;
                    }

                    // End Of Stream
                    const relayListRelayEvent =
                        this.#filterRelayListRelayEvents(receivedRelayEvents);
                    if (!relayListRelayEvent) {
                        resolve([]);
                    }

                    const nip65RelayList: Nip65RelayList[] = [];
                    for (let tag of relayListRelayEvent?.event.tags ?? []) {
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
                        } else if (
                            operation === "read" ||
                            operation === "write"
                        ) {
                            nip65RelayList.push({
                                url,
                                operation,
                            });
                        }
                    }

                    resolve(nip65RelayList);
                }
            );

            NostrRelayerService.instance.relayer.fetchReplaceableEvents(
                channelId,
                pubkey,
                [10002],
                fromRelays
            );
        });
    }

    #filterRelayListRelayEvents(
        relayEvents: RelayEvent[]
    ): RelayEvent | undefined {
        const filteredRelayEvents: RelayEvent[] = [];

        const latestRegularRelayEvent = Array.from(relayEvents)
            .filter((x) => x.event.kind !== 5)
            .sortBy((x) => x.event.created_at, "desc")
            .shift();

        if (typeof latestRegularRelayEvent === "undefined") {
            return undefined;
        }

        const latestDeletionRelayEvent = Array.from(relayEvents)
            .filter((x) => x.event.kind === 5)
            .sortBy((x) => x.event.created_at, "desc")
            .shift();

        if (typeof latestDeletionRelayEvent === "undefined") {
            return latestRegularRelayEvent;
        }

        return latestDeletionRelayEvent.event.created_at >
            latestRegularRelayEvent.event.created_at
            ? undefined
            : latestRegularRelayEvent;
    }
}

