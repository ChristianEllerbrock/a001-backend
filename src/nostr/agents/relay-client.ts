import WebSocket from "ws";
import { v4 } from "uuid";
import { NostrEvent, NostrFilters } from "../nostr";
import EventEmitter = require("events");
import { TIMEOUT } from "dns";

export enum RelayClientEvent {
    onPlayEventOk = "play-event-ok",
    onPlayEventFailed = "play-event-failed",
    onSubscriptionEvent = "subscription-event",
    onSubscriptionEventEose = "subscription-event-eose",
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
    requestTimeoutInMs: number;
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
    private _subscriptionsActive: Map<string, NostrFilters> = new Map<
        string,
        NostrFilters
    >();

    // Hold the subscriptionIds that should be closed
    private _subscriptionsToBeClosed: string[] = [];

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
                requestTimeoutInMs: 10000,
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

    request(filters: NostrFilters, subscriptionId: string): Promise<any[]> {
        return new Promise((resolve, reject) => {
            if (this._subscriptionsActive.has(subscriptionId)) {
                reject("Already subscribed to.");
                return;
            }

            const timeout = setTimeout(() => {
                this.events.off(
                    RelayClientEvent.onSubscriptionEvent,
                    onSubscriptionEvent.bind(this)
                );
                reject("Timeout");
                return;
            }, this._config.requestTimeoutInMs);

            const that = this;
            const eventData: any[] = [];

            const onSubscriptionEvent = function (
                reqSubscriptionId: string,
                data: any
            ) {
                if (subscriptionId !== reqSubscriptionId) {
                    return;
                }

                eventData.push(data);
            };

            const onSubscriptionEventEose = function (
                reqSubscriptionId: string
            ) {
                if (subscriptionId !== reqSubscriptionId) {
                    return;
                }

                clearTimeout(timeout);

                that.events.off(
                    RelayClientEvent.onSubscriptionEvent,
                    onSubscriptionEvent.bind(that)
                );
                that.events.off(
                    RelayClientEvent.onSubscriptionEventEose,
                    onSubscriptionEventEose.bind(that)
                );

                // Make sure that the client unsubscribes with the relay.
                resolve(eventData);
                that.requestClose(subscriptionId);

                return;
            };

            // Subscribe to all relevant internal events.
            this.events.on(
                RelayClientEvent.onSubscriptionEvent,
                onSubscriptionEvent.bind(this)
            );
            this.events.on(
                RelayClientEvent.onSubscriptionEventEose,
                onSubscriptionEventEose.bind(this)
            );

            this._subscriptionsActive.set(subscriptionId, filters);

            this._assureConnection();

            if (this._ws?.readyState === WebSocket.OPEN) {
                // We are already online and can directly request our events.
                this._consoleLog(`Requesting subscription '${subscriptionId}'`);
                this._ws.send(JSON.stringify(["REQ", subscriptionId, filters]));
            } else {
                // The request will be sent once the connection is open.
                // Nothing to do here.
            }
        });
    }

    requestClose(subscriptionId: string) {
        if (!this._subscriptionsActive.has(subscriptionId)) {
            return;
        }

        this._assureConnection();
        if (this._ws?.readyState === WebSocket.OPEN) {
            // We are already online and can directly act.
            this._subscriptionsActive.delete(subscriptionId);
            this._consoleLog(`Closing subscription '${subscriptionId}'`);
            this._ws.send(JSON.stringify(["CLOSE", subscriptionId]));
        } else {
            // The request will be sent once the connection is established.
            // Just push the subscriptionId to the stack.
            this._subscriptionsToBeClosed.push(subscriptionId);
        }
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
        for (let subscriptionId of this._subscriptionsToBeClosed) {
            if (!this._subscriptionsActive.has(subscriptionId)) {
                continue;
            }
            this._subscriptionsActive.delete(subscriptionId);
            this._ws?.send(JSON.stringify(["CLOSE", subscriptionId]));
        }
        this._subscriptionsToBeClosed = [];

        for (let playEvent of this._playNostrEvents) {
            this._consoleLog(`Sending nostr event '${playEvent.id}'`);
            this._ws?.send(JSON.stringify(["EVENT", playEvent]));
        }

        for (let subscription of this._subscriptionsActive) {
            this._consoleLog(`Requesting subscription '${subscription[0]}'`);
            this._ws?.send(
                JSON.stringify(["REQ", subscription[0], subscription[1]])
            );
        }

        this.events.emit(RelayClientEvent.onOpen, event);
    }

    private _onMessage(event: WebSocket.MessageEvent) {
        this._consoleLog("MESSAGE");

        const data = JSON.parse(event.data as string) as any[];

        if (data[0] === "EOSE") {
            this._handleNostrSubscriptionEose(data);
        } else if (data[0] === "EVENT") {
            this._handleNostrSubscriptions(data);
        } else {
            this._handleNostrEvents(data);
        }
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
            this._consoleWarn(JSON.stringify(data));
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

    private _handleNostrSubscriptions(data: any[]) {
        // This should be an event coming from a subscription.
        const subscriptionId = data[1];
        if (!this._subscriptionsActive.has(subscriptionId)) {
            return;
        }

        this.events.emit(
            RelayClientEvent.onSubscriptionEvent,
            subscriptionId,
            data[2]
        );
    }
    private _handleNostrSubscriptionEose(data: any[]) {
        // EOSE: End Of Stored Events
        // data looks like:
        // ["EOSE","c6ac6b18-e58c-4af2-b995-03138c6d6a3d"]
        const subscriptionId = data[1];
        if (!this._subscriptionsActive.has(subscriptionId)) {
            return;
        }

        this.events.emit(
            RelayClientEvent.onSubscriptionEventEose,
            subscriptionId
        );
    }

    private _consoleLog(text: string) {
        if (!this._config.debug) {
            return;
        }

        console.log(`Relay ${this.relay} - ${text}`);
    }

    private _consoleWarn(text: string) {
        if (!this._config.debug) {
            return;
        }

        console.warn(`Relay ${this.relay} - ${text}`);
    }
}

