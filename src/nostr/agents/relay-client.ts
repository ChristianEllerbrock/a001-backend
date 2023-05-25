import WebSocket from "ws";
import { v4 } from "uuid";
import { NostrEvent } from "../nostr";
import EventEmitter = require("events");

export enum RelayClientEvent {
    onPlayEventOk = "play-event-ok",
    onPlayEventFailed = "play-event-failed",
    //onSubscriptionEvent = "subscription-event",
    onError = "error",
    onOpen = "open",
    //onMessage = "message",
    onClose = "close",
    onPing = "ping",
    onPong = "pong",
}

export type RelayClientConfig = {
    debug: boolean;
    sendTimeoutInMs: number;
};

export class RelayClient {
    // #region Public Properties

    events = new EventEmitter();

    get relay(): string {
        return this._relay;
    }

    get id() {
        return this._id;
    }

    // #endregion Public Properties

    // #region Private Properties

    private _relay: string;
    private _id = v4();
    private _ws: WebSocket | undefined;
    private _playNostrEvents: NostrEvent[] = [];
    private _config: RelayClientConfig;

    // #endregion Private Properties

    // #region Constructor

    constructor(
        relay: string,
        config: RelayClientConfig | undefined = undefined
    ) {
        this._relay = relay;
        if (config) {
            this._config = config;
        } else {
            this._config = {
                debug: false,
                sendTimeoutInMs: 10000,
            };
        }
    }

    // #endregion Constructor

    // #region Public Methods

    // CONNECTING: 0
    // OPEN: 1
    // CLOSING: 2
    // CLOSED: 3
    private _assureConnection() {
        if (this._ws?.readyState === WebSocket.OPEN) {
            return; // we are already online and ready
        }

        if (this._ws) {
            this._ws.off("error", this._onError.bind(this));
            this._ws.off("open", this._onOpen.bind(this));
            this._ws.off("message", this._onMessage.bind(this));
            this._ws.off("close", this._onClose.bind(this));

            this._ws.terminate();
        }

        this._ws = new WebSocket(this._relay, {
            timeout: 30,
        });

        this._ws.onerror = this._onError.bind(this);
        this._ws.onopen = this._onOpen.bind(this);
        this._ws.onmessage = this._onMessage.bind(this);
        this._ws.onclose = this._onClose.bind(this);
    }

    send(event: NostrEvent): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.events.off(
                    RelayClientEvent.onPlayEventOk,
                    onPlayEventOk.bind(this)
                );
                this.events.off(
                    RelayClientEvent.onPlayEventFailed,
                    onPlayEventFailed.bind(this)
                );
                reject("Timeout");
                return;
            }, this._config.sendTimeoutInMs);

            const that = this;

            const onPlayEventOk = function (eventId: any) {
                if (event.id === eventId) {
                    that.events.off(
                        RelayClientEvent.onPlayEventOk,
                        onPlayEventOk.bind(that)
                    );
                    that.events.off(
                        RelayClientEvent.onPlayEventFailed,
                        onPlayEventFailed.bind(that)
                    );

                    clearTimeout(timeout);
                    resolve();
                    return;
                }
            };

            const onPlayEventFailed = function (eventId: any) {
                if (event.id !== eventId) {
                    return;
                }

                that.events.off(
                    RelayClientEvent.onPlayEventOk,
                    onPlayEventOk.bind(that)
                );
                that.events.off(
                    RelayClientEvent.onPlayEventFailed,
                    onPlayEventFailed.bind(that)
                );
                clearTimeout(timeout);
                reject();
                return;
            };

            // Subscribe to all relevant internal events.
            this.events.on(
                RelayClientEvent.onPlayEventOk,
                onPlayEventOk.bind(this)
            );

            this.events.on(
                RelayClientEvent.onPlayEventFailed,
                onPlayEventFailed.bind(this)
            );

            this._playNostrEvents.unshift(event);

            this._assureConnection();

            if (this._ws?.readyState === WebSocket.OPEN) {
                // We are already online and can directly send our event.
                this._consoleLog(`Sending nostr event '${event.id}'`);
                this._ws.send(JSON.stringify(["EVENT", event]));
            } else {
                // The event will be sent once the connection is open.
                // Nothing to do here.
            }
        });
    }

    close() {
        if (!this._ws) {
            return;
        }

        this._ws.close();
    }

    // #endregion Public Methods

    // #region Private Methods

    private _onError(event: WebSocket.ErrorEvent) {
        this._consoleLog("ERROR");
        //this.events.emit(RelayClientEvent.onError, event);
    }

    private _onOpen(event: WebSocket.Event): any {
        this._consoleLog("OPEN");
        for (let playEvent of this._playNostrEvents) {
            this._consoleLog(`Sending nostr event '${playEvent.id}'`);
            this._ws?.send(JSON.stringify(["EVENT", playEvent]));
        }

        this.events.emit(RelayClientEvent.onOpen, event);
    }

    private _onMessage(event: WebSocket.MessageEvent) {
        this._consoleLog("MESSAGE");

        const data = JSON.parse(event.data as string) as any[];

        this._handleNostrEvents(data);
    }

    private _onClose(event: WebSocket.CloseEvent) {
        this._consoleLog("CLOSE");
        this.events.emit(RelayClientEvent.onClose, event);
    }

    private _handleNostrEvents(data: any[]) {
        // Check if this is a response to an event that we have sent.
        const index = this._playNostrEvents.findIndex((x) => x.id === data[1]);
        if (index === -1) {
            // Not from us.
            this._consoleLog("Message not for an event that we sent => ignore");
            return;
        }

        // Remove event from list.
        this._playNostrEvents.splice(index, 1);

        // Check if the response indicates SUCCESS or FAILURE
        if (data[0] === "OK") {
            // SUCCESS response
            this._consoleLog("Sending ok");
            this.events.emit(RelayClientEvent.onPlayEventOk, data[1]);
        } else {
            // FAILURE response
            this._consoleLog("Sending failed");
            this.events.emit(RelayClientEvent.onPlayEventFailed, data[1]);
        }
    }

    private _consoleLog(text: string) {
        if (!this._config.debug) {
            return;
        }

        console.log(`Relay ${this.relay} - ${text}`);
    }
}

