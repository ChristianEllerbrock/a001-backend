import { Nostr, NostrEventKind } from "../nostr/nostr";
import { NostrClient } from "../nostr/nostr-client";
import { EnvService } from "./env-service";

export enum SendCodeReason {
    Registration,
    Login,
}

export class RelayService {
    // #region Singleton

    private static _instance: RelayService;

    static get instance() {
        if (this._instance) {
            return this._instance;
        }

        this._instance = new RelayService();
        return this._instance;
    }

    constructor() {
        this._botPrivkey = EnvService.instance.env.BOT_PRIVKEY ?? "na";
    }

    // #endregion Singleton

    // #region Private Properties

    private _botPrivkey: string;

    // #endregion Private Properties

    // #region Public Properties

    get botPubKey(): string | undefined {
        if (!this._botPrivkey) {
            return undefined;
        }
        return Nostr.getPubKeyHexObjectFromPrivKey(this._botPrivkey).hex;
    }

    // #endregion Public Properties

    // #region Public Methods

    async sendCodeAsync(
        relayAddress: string,
        pubkey: string,
        code: string,
        reason: SendCodeReason,
        fraudId: string
    ): Promise<boolean> {
        const client = new NostrClient(relayAddress);

        // First, send the NIP05 infos from the sending bot to the relay.
        const kind0Content = {
            name: "nip05.social",
            nip05: "bot@" + EnvService.instance.env.DOMAIN,
        };

        const kind0Event = Nostr.createEvent({
            privkey: this._botPrivkey,
            data: {
                kind: NostrEventKind.Metadata,
                pubkey: this.botPubKey as string,
                created_at: Math.floor(Date.now() / 1000),
                content: JSON.stringify(kind0Content),
                tags: [],
            },
        });
        await client.sendAsync(kind0Event);

        // Second, send the direct message with the login/registration information to the receiver.
        let content = "";
        if (reason === SendCodeReason.Registration) {
            content = `Your REGISTRATION code is:
            
${Array.from(code).join(" ")}

If you did not initiate this registration you can either ignore this message or click on the following link to report a fraud attempt:

https://nip05.social/registration-fraud/${fraudId}

Your nip05.social Team`;
        } else {
            content = `Your LOGIN code is:

${Array.from(code).join(" ")}

If you did not initiate this login you can either ignore this message or click on the following link to report a fraud attempt:

https://nip05.social/login-fraud/${fraudId}

Your nip05.social Team`;
        }

        const encryptedRegisterContent = await Nostr.encryptDirectMessage(
            this._botPrivkey,
            pubkey,
            content
        );

        const kind4Event = Nostr.createEvent({
            privkey: this._botPrivkey,
            data: {
                pubkey: this.botPubKey as string,
                created_at: Math.floor(Date.now() / 1000),
                kind: 4,
                tags: [["p", pubkey]],
                content: encryptedRegisterContent,
            },
        });
        console.log(kind4Event);
        await client.sendAsync(kind4Event);

        //client.close();
        // await relay.close(); Currently leads to an error
        return true;
    }

    // #endregion Public Methods

    // #endregion Private Methods
}

