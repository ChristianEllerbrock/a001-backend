import { Nip05 } from "../nostr/type-defs";

export class EmailCacheService {
    // #region Singleton

    static #instance: EmailCacheService;

    static get instance() {
        if (this.#instance) {
            return this.#instance;
        }

        this.#instance = new EmailCacheService();
        return this.#instance;
    }

    // #endregion Singleton

    readonly cache = new Map<string, Nip05>();
}
