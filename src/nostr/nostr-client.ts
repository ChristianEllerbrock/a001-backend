import { DateTime } from "luxon";
import WebSocket from "ws";
import { NostrEvent } from "./nostr";

const ON = {
    ERROR: "error",
    OPEN: "open",
    MESSAGE: "message",
    CLOSE: "close",
    PING: "ping",
};

export interface NostrClientConfig {
    sendTimeoutInSeconds: number;
}

export class NostrClient {
    // #region Private Properties

    private _ws: WebSocket | undefined;
    private _relay: string;
    private _config: NostrClientConfig;

    // #endregion Private Properties

    // #region Constructor

    constructor(
        relay: string,
        config: NostrClientConfig | undefined = undefined
    ) {
        this._relay = relay;

        if (config) {
            this._config = config;
        } else {
            // Set defaults.
            this._config = {
                sendTimeoutInSeconds: 15,
            };
        }
    }

    // #endregion Constructor

    // #region Public Methods

    connect() {
        if (this._ws) {
            this._ws.off(ON.ERROR, this._onError);
            this._ws.off(ON.OPEN, this._onOpen);
            this._ws.off(ON.MESSAGE, this._onMessage);
            this._ws.off(ON.CLOSE, this._onClose);
            this._ws.off(ON.PING, this._onPing);
            this._ws.terminate();
        }

        this._ws = new WebSocket(this._relay);
        this._ws.on(ON.ERROR, this._onError);
        this._ws.on(ON.OPEN, this._onOpen);
        this._ws.on(ON.MESSAGE, this._onMessage);
        this._ws.on(ON.CLOSE, this._onClose);
        this._ws.on(ON.PING, this._onPing);
    }

    async sendAsync(event: NostrEvent): Promise<void> {
        const now = DateTime.now();

        if (
            !this._ws ||
            this._ws.readyState === WebSocket.CLOSED ||
            this._ws.readyState === WebSocket.CLOSING
        ) {
            this.connect();
        }

        if (!this._ws) {
            throw new Error("Could not set up connection.");
        }

        if (this._ws.readyState === WebSocket.OPEN) {
            this._ws.send(JSON.stringify(["EVENT", event]));
            return;
        }

        // CLOSED, CLOSING, CONNECTING
        let readStateString = "";
        switch (this._ws.readyState) {
            case WebSocket.CONNECTING:
                readStateString = "CONNECTING";
                break;

            case WebSocket.CLOSING:
                readStateString = "CLOSING";
                break;

            case WebSocket.CLOSED:
                readStateString = "CLOSED";
                break;

            default:
                readStateString = "UNKNOWN";
                break;
        }
        if (
            this._ws.readyState === WebSocket.CLOSED ||
            this._ws.readyState === WebSocket.CLOSING
        ) {
            throw new Error(
                `Cannot send message in state: ${readStateString}.`
            );
        }

        // Only CONNECTING left
        // Wait until we are connected or throw an exception if the timeout is reached.
        let diffInSeconds = now.diffNow("seconds").seconds;
        while (diffInSeconds > -1 * this._config.sendTimeoutInSeconds) {
            await this._sleep(2000);
            // @ts-ignore
            if (this._ws.readyState === WebSocket.OPEN) {
                this._ws.send(JSON.stringify(["EVENT", event]));
                return;
            }
            diffInSeconds = now.diffNow("seconds").seconds;
        }

        throw new Error("Send timeout reached. Could not send message.");
    }

    close() {
        this._ws?.close();
    }

    // #endregion Public Methods

    // #region Private Methods

    private _onError(event: any) {
        console.log(`OnError: ${event}`);
    }

    private _onOpen() {
        console.log("OnOpen");
    }

    private _onMessage(event: any) {
        console.log("OnMessage:");
        console.log(String.fromCharCode.apply(null, event));
    }

    private _onClose() {
        console.log("OnClose");
    }

    private _onPing() {
        console.log("OnPing");
    }

    private _sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // #endregion Private Methods
}

