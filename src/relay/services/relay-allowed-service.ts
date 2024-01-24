export class RelayAllowedService {
    // #region Singleton
    static #instance: RelayAllowedService;

    static get instance() {
        if (this.#instance) {
            return this.#instance;
        }

        this.#instance = new RelayAllowedService();
        return this.#instance;
    }

    // #endregion Singleton

    readonly pubkeys_auth = new Set<string>();
    readonly pubkeys_publishKind4 = new Set<string>();

    addPubkeys(pubkeys: string[], allow: "auth") {
        switch (allow) {
            case "auth":
                this.#addToSet(this.pubkeys_auth, pubkeys);
                break;

            default:
                break;
        }
    }

    removePubkeys(pubkeys: string[], disallow: "auth") {
        switch (disallow) {
            case "auth":
                this.#removeFromSet(this.pubkeys_auth, pubkeys);
                break;

            default:
                break;
        }
    }

    #addToSet(set: Set<string>, pubkeys: string[]) {
        pubkeys.forEach((x) => set.add(x));
    }

    #removeFromSet(set: Set<string>, pubkeys: string[]) {
        pubkeys.forEach((x) => set.delete(x));
    }
}

