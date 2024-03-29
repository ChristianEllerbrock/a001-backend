import { Nip05 } from "../nostr/type-defs";

export interface EmailNip05 {
    nip05: Nip05;
    emailNostrId: number;
    emailId: number;
}

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

    readonly cache = new Map<string, EmailNip05>();
}

