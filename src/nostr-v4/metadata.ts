import { nip05 } from "nostr-tools";
import { RelayEvent } from "./type-defs";

export interface Metadata {
    about?: string;
    banner?: string;
    name?: string;
    userName?: string;
    picture?: string;
    nip05?: string;
    lud15?: string;
    website?: string;
}

export class MetadataWrapper {
    get confirmedNip05() {
        if (!this.#hasEvaluatedNip05) {
            this.#hasEvaluatedNip05 = true;
            this.evaluateNip05();
        }
        return this.#confirmedNip05;
    }

    get confirmedNip05Relays(): string[] {
        if (!this.#hasEvaluatedNip05) {
            this.#hasEvaluatedNip05 = true;
            this.evaluateNip05();
        }

        return this.#confirmedNip05Relays;
    }

    get metadata() {
        if (!this.#metadata) {
            this.#metadata = JSON.parse(
                this.#relayEvent.event.content
            ) as Metadata;
        }

        return this.#metadata;
    }

    get relayEvent() {
        return this.#relayEvent;
    }

    #confirmedNip05: string | undefined;
    #confirmedNip05Relays: string[] = [];
    #hasEvaluatedNip05 = false;
    #metadata: Metadata | undefined;
    #relayEvent: RelayEvent;

    constructor(relayEvent: RelayEvent) {
        if (relayEvent.event.kind !== 0) {
            throw new Error("Invalid event. Only a kind 0 event is allowed.");
        }
        this.#relayEvent = relayEvent;
    }

    reset(newRelayEvent: RelayEvent) {
        this.#relayEvent = newRelayEvent;
        this.#hasEvaluatedNip05 = false;
        this.#confirmedNip05 = undefined;
        this.#confirmedNip05Relays = [];
    }

    async evaluateNip05() {
        if (!this.metadata.nip05) {
            return;
        }

        const result = await nip05.queryProfile(this.metadata.nip05);
        if (result?.pubkey === this.#relayEvent.event.pubkey) {
            this.#confirmedNip05 = this.metadata.nip05;

            if (typeof result.relays !== "undefined") {
                this.#confirmedNip05Relays = result.relays;
            }
        }
    }
}

