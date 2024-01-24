import { IncomingMessage } from "http";
import { WebSocket } from "ws";
import {
    RelayWebSocketServerAdapterEvent,
    RelayWebSocketServerAdapter,
} from "./web-socket-server-adapter";
import { createLogger } from "./common";
import { v4 } from "uuid";
import { attemptValidation } from "../utils/validation";
import { messageSchema } from "../schemas/message-schema";
import {
    MessageTypeFromClient,
    MessageTypeFromRelay,
} from "../@types/messages";
import { auth } from "../utils/auth";
import { Event, Filter } from "nostr-tools";
import { EventEmitter } from "stream";
import { createMessageHandler } from "../handlers/create-handler";
import { SubscriptionId } from "../@types/subscription";
import { isEventMatchingFilter } from "../utils/event";
import { createOutgoing_EVENT_Message } from "../utils/messages";

const debug = createLogger("[Relay] - RelayWebSocketAdapter");

export enum RelayWebSocketAdapterEvent {
    //Event = "event",
    SendMessageToClient = "SendMessageToClient",
    ProcessEventToClient = "ProcessEventToClient",
    BroadcastToClients = "BroadcastToClients",
    Subscribe = "Subscribe",
    Unsubscribe = "Unsubscribe",
    //Heartbeat = "heartbeat",
}

export class RelayWebSocketAdapter extends EventEmitter {
    #clientId: string;
    #alive = true;
    #isAuthenticated = false;
    #authenticatedPubkey: string | undefined;
    #challenge = v4();
    #subscriptions = new Map<SubscriptionId, Filter[]>();

    constructor(
        private readonly client: WebSocket,
        private readonly connectionRequest: IncomingMessage,
        private readonly webSocketServerAdapter: RelayWebSocketServerAdapter
    ) {
        super();

        this.client
            .on("message", this.#onClientMessage.bind(this))
            .on("close", this.#onClientClose.bind(this))
            .on("ping", this.#onClientPing.bind(this))
            .on("pong", this.#onClientPong.bind(this))
            .on("error", (error) => {
                debug(`clientId ${this.#clientId} error: ${error}`);
                this.client.close();
            });

        this.on(
            RelayWebSocketAdapterEvent.SendMessageToClient,
            this.#sendMessageToClient.bind(this)
        )
            .on(
                RelayWebSocketAdapterEvent.Subscribe,
                this.#subscribe.bind(this)
            )
            .on(
                RelayWebSocketAdapterEvent.Unsubscribe,
                this.#unsubscribe.bind(this)
            )
            .on(
                RelayWebSocketAdapterEvent.BroadcastToClients,
                this.#broadcastToClients.bind(this)
            )
            .on(
                RelayWebSocketAdapterEvent.ProcessEventToClient,
                this.#processEventToClient.bind(this)
            );

        this.#clientId = Buffer.from(
            this.connectionRequest.headers["sec-websocket-key"] as string,
            "base64"
        ).toString("hex");
        debug(`clientId ${this.#clientId}: connected`);
        this.#sendMessageToClient(["AUTH", this.#challenge]);
    }

    async #onClientMessage(raw: Buffer) {
        this.#alive = true;
        debug(`clientId ${this.#clientId}: message: ${raw}`);

        try {
            const message = attemptValidation(messageSchema)(
                JSON.parse(raw.toString("utf8"))
            );

            if (!this.#isAuthenticated) {
                // The client IS NOT authenticated.
                if (message[0] === MessageTypeFromClient.REQ) {
                    this.#sendMessageToClient([
                        MessageTypeFromRelay.CLOSED,
                        message[1],
                        "auth-required: We only serve registered, authenticated users.",
                    ]);
                    return;
                }

                if (message[0] === MessageTypeFromClient.EVENT) {
                    const event = message[1] as Event;
                    this.#sendMessageToClient([
                        MessageTypeFromRelay.OK,
                        event.id,
                        false,
                        "auth-required: We only accept events from registered, authenticated users.",
                    ]);
                    return;
                }

                if (message[0] === MessageTypeFromClient.AUTH) {
                    const authEvent = message[1] as Event;
                    const authResult = auth(authEvent, {
                        challenge: this.#challenge,
                        relayUrl: this.webSocketServerAdapter.relayConfig.url,
                    });
                    this.#isAuthenticated = authResult[0];
                    if (this.#isAuthenticated) {
                        this.#authenticatedPubkey = authEvent.pubkey;
                    }
                    this.#sendMessageToClient([
                        MessageTypeFromRelay.OK,
                        authEvent.id,
                        authResult[0],
                        authResult[1],
                    ]);
                    return;
                }
            } else {
                // Continue, the client IS authenticated.
                const messageHandler = createMessageHandler(message, this);
                await messageHandler.handleMessage(message);
            }
        } catch (error: any) {
            debug(`clientId ${this.#clientId}: message error: ${error}`);
            this.#sendMessageToClient([
                MessageTypeFromRelay.NOTICE,
                `Error: ${error?.message}`,
            ]);
        }
    }

    #onClientClose(event: any) {
        debug(`close ${event}`);
        this.#alive = false;

        this.client.removeAllListeners();
    }

    #onClientPing(data: any) {
        debug(`ping: ${data}`);
        this.client.pong(data);
        this.#alive = true;
    }

    #onClientPong() {
        debug(`pong`);
        this.#alive = true;
    }

    #sendMessageToClient(message: any): void {
        if (this.client.readyState !== WebSocket.OPEN) {
            return;
        }
        debug(`clientId ${this.#clientId}: send ${JSON.stringify(message)}`);
        this.client.send(JSON.stringify(message));
    }

    #subscribe(subscriptionId: SubscriptionId, filters: Filter[]) {
        this.#subscriptions.set(subscriptionId, filters);
    }

    #unsubscribe(subscriptionId: SubscriptionId) {
        this.#subscriptions.delete(subscriptionId);
    }

    #broadcastToClients(event: Event) {
        this.webSocketServerAdapter.emit(
            RelayWebSocketServerAdapterEvent.BroadcastToClients,
            event
        );
    }

    /**
     * Check, if the event matches any subscription filters and
     * send it if so.
     */
    #processEventToClient(event: Event) {
        this.#subscriptions.forEach((filters, subscriptionId) => {
            const eventMatchesFilters = filters.some((x) =>
                isEventMatchingFilter(x)(event)
            );

            if (eventMatchesFilters) {
                this.#sendMessageToClient(
                    createOutgoing_EVENT_Message(subscriptionId, event)
                );
            }
        });
    }
}

