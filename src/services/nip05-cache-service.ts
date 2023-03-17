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

    set(identifier: string, registrationId: string, nip05: Nip05): CacheStore {
        const cacheStore: CacheStore = {
            registrationId: registrationId,
            nip05,
        };
        this._cacheStore.set(identifier, cacheStore);
        return cacheStore;
    }

    get(identifier: string): CacheStore | undefined {
        return this._cacheStore.get(identifier);
    }

    has(identifier: string): boolean {
        return this._cacheStore.has(identifier);
    }

    invalidate(identifier: string): boolean {
        return this._cacheStore.delete(identifier);
    }

    invalidateCache() {
        this._cacheStore.clear();
    }

    // #endregion Public Methods
}

