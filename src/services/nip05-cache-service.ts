import { Nip05 } from "../nostr/type-defs";

interface CacheStore {
    registrationId: string;
    nip05: Nip05;
}

export class Nip05CacheService {
    // #region Singleton

    private static _instance: Nip05CacheService;

    static get instance() {
        if (this._instance) {
            return this._instance;
        }

        this._instance = new Nip05CacheService();
        return this._instance;
    }

    // #endregion Singleton

    // #region Public Properties

    /** THe number of identifiers in the cache. */
    get items(): number {
        return this._cacheStore.size;
    }

    // #endregion Public Properties

    // #region Private Properties

    private _cacheStore = new Map<string, CacheStore>();

    // #endregion Private Properties

    // #region Public Methods

    set(
        identifierPlusDomain: string,
        registrationId: string,
        nip05: Nip05
    ): CacheStore {
        const cacheStore: CacheStore = {
            registrationId: registrationId,
            nip05,
        };
        this._cacheStore.set(identifierPlusDomain, cacheStore);
        return cacheStore;
    }

    get(identifierPlusDomain: string): CacheStore | undefined {
        return this._cacheStore.get(identifierPlusDomain);
    }

    has(identifierPlusDomain: string): boolean {
        return this._cacheStore.has(identifierPlusDomain);
    }

    invalidate(identifierPlusDomain: string): boolean {
        return this._cacheStore.delete(identifierPlusDomain);
    }

    invalidateCache() {
        this._cacheStore.clear();
    }

    // #endregion Public Methods
}

