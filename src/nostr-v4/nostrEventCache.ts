import { RelayEvent } from "./type-defs";

export class NostrEventCache {
    readonly events = new Map<string, RelayEvent[]>();
    readonly deletionEvents = new Map<string, RelayEvent[]>();

    cacheEvents(relayEvents: RelayEvent[]) {
        relayEvents.forEach((x) => this.cacheEvent(x));
    }

    cacheEvent(relayEvent: RelayEvent): boolean {
        if (relayEvent.event.kind === 5) {
            return this.#cacheDeletionEvent(relayEvent);
        }

        return this.#cacheRegularEvent(relayEvent);
    }

    printCache() {
        console.log(this.events);
        console.log(this.deletionEvents);
    }

    isDeleted(relayEvent: RelayEvent): boolean {
        const kind = relayEvent.event.kind;
        if (relayEvent.event.kind === 5) {
            return false;
        }

        if ([0, 3].includes(kind) || (kind >= 10000 && kind < 20000)) {
            // Replaceable Event
            // <kind>:<pubkey>

            for (const cachedDeletionEventMap of this.deletionEvents) {
                const cachedDeletionEvent = cachedDeletionEventMap[1][0];
                for (const tag of cachedDeletionEvent.event.tags) {
                    if (
                        tag[0] === "e" &&
                        tag[1].includes(relayEvent.event.id)
                    ) {
                        return true;
                    }

                    if (
                        tag[0] === "a" &&
                        tag[1].includes(`${kind}:${relayEvent.event.pubkey}`) &&
                        cachedDeletionEvent.event.created_at >
                            relayEvent.event.created_at
                    ) {
                        return true;
                    }
                }
            }
        }

        if (kind >= 30000 && kind < 40000) {
            //Parameterized Replaceable Event
            // <kind>:<pubke<>:<d-tag>

            let dTag = "unknown";
            for (const tag of relayEvent.event.tags) {
                if (tag[0] === "d") {
                    dTag = tag[1];
                }
            }

            for (const cachedDeletionEventMap of this.deletionEvents) {
                const cachedDeletionEvent = cachedDeletionEventMap[1][0];
                for (const tag of cachedDeletionEvent.event.tags) {
                    if (
                        tag[0] === "e" &&
                        tag[1].includes(relayEvent.event.id)
                    ) {
                        return true;
                    }

                    if (
                        tag[0] === "a" &&
                        tag[1].includes(
                            `${kind}:${relayEvent.event.pubkey}:${dTag}`
                        ) &&
                        cachedDeletionEvent.event.created_at >
                            relayEvent.event.created_at
                    ) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    #cacheDeletionEvent(relayEvent: RelayEvent): boolean {
        if (relayEvent.event.kind !== 5) {
            return false;
        }

        let details = this.deletionEvents.get(relayEvent.event.id);
        if (typeof details === "undefined") {
            details = [relayEvent];
            this.deletionEvents.set(relayEvent.event.id, details);
            return true;
        }

        if (details.find((x) => x.url === relayEvent.url)) {
            return false;
        }

        details.push(relayEvent);
        return true;
    }

    #cacheRegularEvent(relayEvent: RelayEvent): boolean {
        if (relayEvent.event.kind === 5) {
            return false;
        }

        let details = this.events.get(relayEvent.event.id);
        if (typeof details === "undefined") {
            details = [relayEvent];
            this.events.set(relayEvent.event.id, details);
            return true;
        }

        if (details.find((x) => x.url === relayEvent.url)) {
            return false;
        }

        details.push(relayEvent);
        return true;
    }
}

