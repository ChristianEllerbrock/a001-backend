import { NostrRelayer } from "../nostr-v4/nostrRelayer";

export class NostrRelayerService {
    static #instance: NostrRelayerService;
    static get instance(): NostrRelayer {
        if (!this.#instance) {
            this.#instance = new NostrRelayerService();
        }

        return this.#instance.#relayer;
    }

    #relayer: NostrRelayer;

    constructor() {
        this.#relayer = new NostrRelayer();
    }
}

