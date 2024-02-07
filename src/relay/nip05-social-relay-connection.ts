import { IncomingMessage } from "http";
import { WebSocket } from "ws";
import { Nip05SocialRelayEvent, Nip05SocialRelay } from "./nip05-social-relay";
import { createLogger } from "./utils/common";
import { v4 } from "uuid";
import { attemptValidation } from "./utils/validation";
import { messageSchema } from "./schemas/message-schema";
import { MessageTypeFromClient, MessageTypeFromRelay } from "./@types/messages";
import { auth } from "./utils/auth";
import { Event, Filter } from "nostr-tools";
import { EventEmitter } from "stream";
import { createMessageHandler } from "./handlers/create-handler";
import { SubscriptionId } from "./@types/subscription";
import { isEventMatchingFilter } from "./utils/event";
import { createOutgoing_EVENT_Message } from "./utils/messages";
import { PrismaService } from "../services/prisma-service";
import { RelayConnection } from "@prisma/client";
import { DateTime } from "luxon";
import { Nip05SocialRelayAllowedService } from "./nip05-social-relay-allowed-service";

const debug = createLogger("[Relay] - RelayWebSocketAdapter");

export enum Nip05SocialRelayConnectionEvent {
    //Event = "event",
    SendMessageToClient = "SendMessageToClient",
    ProcessEventToClient = "ProcessEventToClient",
    BroadcastToClients = "BroadcastToClients",
    Subscribe = "Subscribe",
    Unsubscribe = "Unsubscribe",
    //Heartbeat = "heartbeat",
}

export class Nip05SocialRelayConnection extends EventEmitter {
    get isAuthenticated(): boolean {
        return this.#isAuthenticated;
    }

    #clientId: string;
    #alive = true;
    #isAuthenticated = false;
    #authenticatedPubkey: string | undefined;
    #challenge = v4();
    #subscriptions = new Map<SubscriptionId, Filter[]>();

    constructor(
        private readonly client: WebSocket,
        private readonly connectionRequest: IncomingMessage,
        private readonly relay: Nip05SocialRelay,
        private dbRelayConnection: RelayConnection
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
                this.#calculateUptimeAndUpdateDatabase();
            });

        this.on(
            Nip05SocialRelayConnectionEvent.SendMessageToClient,
            this.#sendMessageToClient.bind(this)
        )
            .on(
                Nip05SocialRelayConnectionEvent.Subscribe,
                this.#subscribe.bind(this)
            )
            .on(
                Nip05SocialRelayConnectionEvent.Unsubscribe,
                this.#unsubscribe.bind(this)
            )
            .on(
                Nip05SocialRelayConnectionEvent.BroadcastToClients,
                this.#broadcastToClients.bind(this)
            )
            .on(
                Nip05SocialRelayConnectionEvent.ProcessEventToClient,
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

            let bypassAuth = false;
            // Certain system accounts should NOT be forced to perform an AUTH
            // for Kind 0 (Metadata), Kind 1 (Note) and Kind 4 (direct messages) EVENTs.
            if (message[0] === MessageTypeFromClient.EVENT) {
                const event = message[1] as Event;

                if ([0, 1, 4].includes(event.kind)) {
                    // We received a kind 0, 1 or 4 event.
                    // Check if it originates from an "allowed" pubkey.

                    if (
                        Nip05SocialRelayAllowedService.instance.systemPubkeys.has(
                            event.pubkey
                        )
                    ) {
                        bypassAuth = true;
                    } else if (
                        Nip05SocialRelayAllowedService.instance.systemPubkeys_emailOutBots.has(
                            event.pubkey
                        )
                    ) {
                        bypassAuth = true;
                    } else if (
                        Nip05SocialRelayAllowedService.instance.systemPubkeys_emailMirror.has(
                            event.pubkey
                        )
                    ) {
                        bypassAuth = true;
                    }
                }
            }

            if (bypassAuth || this.isAuthenticated) {
                // Continue, the client is authenticated or allowed.
                const messageHandler = createMessageHandler(message, this);
                await messageHandler.handleMessage(message);
            } else {
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
                        relayUrl: this.relay.config?.url ?? "na",
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

        this.#calculateUptimeAndUpdateDatabase();
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
        this.relay.emit(Nip05SocialRelayEvent.BroadcastToClients, event);
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

    async #calculateUptimeAndUpdateDatabase() {
        const now = DateTime.now();

        const uptimeInSeconds = now
            .diff(DateTime.fromJSDate(this.dbRelayConnection.date), "seconds")
            .toObject().seconds;

        await PrismaService.instance.db.relayConnection.update({
            where: { id: this.dbRelayConnection.id },
            data: {
                uptimeInSeconds: Math.floor(uptimeInSeconds ?? 0),
            },
        });
    }
}

