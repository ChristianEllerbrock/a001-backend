const NodeCache = require("node-cache");

export class CacheService {
    // #region Singleton

    private static _instance: CacheService;
    static get instance() {
        if (this._instance) {
            return this._instance;
        }

        this._instance = new CacheService();
        return this._instance;
    }

    // #endregion Singleton

    constructor() {
        this._cache = new NodeCache();
    }

    // #region Private Properties

    private _cache: any;
    private _ttlInSecondsDefault = 60;

    // #endregion Private Properties

    // #region Public Methods

    set(
        key: any,
        value: any,
        ttlInSeconds: number | undefined = undefined
    ): boolean {
        const ttl =
            typeof ttlInSeconds === "undefined"
                ? this._ttlInSecondsDefault
                : ttlInSeconds;

        return this._cache.set(key, value, ttl);
    }

    get<T>(key: any): T | undefined {
        const value = this._cache.get(key);
        if (value == undefined) {
            return undefined;
        }

        return value as T;
    }

    has(key: any): boolean {
        return this._cache.has(key) as boolean;
    }

    // #endregion Public Methods
}

