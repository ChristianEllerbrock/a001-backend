export class Nip05SocialRelayAllowedService {
    // #region Singleton
    static #instance: Nip05SocialRelayAllowedService;

    static get instance() {
        if (this.#instance) {
            return this.#instance;
        }

        this.#instance = new Nip05SocialRelayAllowedService();
        return this.#instance;
    }

    // #endregion Singleton

    readonly pubkeys_auth = new Set<string>();
    readonly systemPubkeys_emailMirror = new Set<string>();
    readonly systemPubkeys_emailOutBots = new Set<string>();

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

    addSystemPubkeys(
        pubkeys: string[],
        type: "email-mirror" | "email-out-bot"
    ) {
        switch (type) {
            case "email-mirror":
                this.#addToSet(this.systemPubkeys_emailMirror, pubkeys);
                break;

            case "email-out-bot":
                this.#addToSet(this.systemPubkeys_emailOutBots, pubkeys);
                break;

            default:
                break;
        }
    }

    removeSystemPubkeys(
        pubkeys: string[],
        type: "email-mirror" | "email-out-bot"
    ) {
        switch (type) {
            case "email-mirror":
                this.#removeFromSet(this.systemPubkeys_emailMirror, pubkeys);
                break;

            case "email-out-bot":
                this.#removeFromSet(this.systemPubkeys_emailOutBots, pubkeys);
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

