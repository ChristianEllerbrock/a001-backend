import { IncomingMessage } from "http";
import { WebSocket, WebSocketServer } from "ws";
import {
    Nip05SocialRelayConnection,
    Nip05SocialRelayConnectionEvent,
} from "./nip05-social-relay-connection";
import { createLogger } from "./utils/common";
import { Nip05SocialRelayConfig } from "./config";
import { EventEmitter } from "stream";
import { PrismaService } from "../services/prisma-service";

const WSS_CLIENT_HEALTH_PROBE_INTERVAL = 120000;
const debug = createLogger("[Relay] - RelayWebSocketServerAdapter");

export enum Nip05SocialRelayEvent {
    BroadcastToClients = "BroadcastToClients",
}

export class Nip05SocialRelay extends EventEmitter {
    // #region Singleton
    static #i: Nip05SocialRelay;

    static get i() {
        if (this.#i) {
            return this.#i;
        }

        this.#i = new Nip05SocialRelay();
        return this.#i;
    }

    // #endregion Singleton

    config: Nip05SocialRelayConfig | undefined;
    #connections = new WeakMap<WebSocket, Nip05SocialRelayConnection>();

    #wsServer: WebSocketServer | undefined;
    #heartbeatInterval: NodeJS.Timer | undefined;

    constructor() {
        super();
    }

    initialize(
        webSocketServer: WebSocketServer,
        relayConfig: Nip05SocialRelayConfig
    ) {
        this.#wsServer = webSocketServer;
        this.config = relayConfig;

        this.#wsServer.on("connection", this.#onConnection.bind(this));
        // .on("error", (error) => {
        //     debug(`error: ${error}`);
        // });

        this.on(
            Nip05SocialRelayEvent.BroadcastToClients,
            this.#broadcastToClients.bind(this)
        );
        this.#heartbeatInterval = setInterval(
            this.#onHeartbeat.bind(this),
            WSS_CLIENT_HEALTH_PROBE_INTERVAL
        );
    }

    getConnections(): Nip05SocialRelayConnection[] {
        if (!this.#wsServer) {
            return [];
        }

        const connections: Nip05SocialRelayConnection[] = [];

        this.#wsServer.clients.forEach((x) => {
            if (x.readyState !== WebSocket.OPEN) {
                return;
            }

            const wsAdapter = this.#connections.get(x);
            if (!wsAdapter) {
                return;
            }
            connections.push(wsAdapter);
        });

        return connections;
    }

    async #onConnection(client: WebSocket, req: IncomingMessage) {
        //console.log(req.socket);

        debug(`connect: ${req.socket.remoteAddress}`);

        client.on("error", (error) => {
            debug(`error: ${error}`);
        });

        // Todo: Disconnect limited clients

        const dbRelayConnection =
            await PrismaService.instance.db.relayConnection.create({
                data: {
                    date: new Date(),
                },
            });

        this.#connections.set(
            client,
            new Nip05SocialRelayConnection(client, req, this, dbRelayConnection)
        );

        // todo
    }

    #onHeartbeat() {
        //
    }

    #broadcastToClients(event: Event) {
        if (!this.#wsServer) {
            return;
        }

        this.#wsServer.clients.forEach((x) => {
            if (x.readyState !== WebSocket.OPEN) {
                return;
            }

            const wsAdapter = this.#connections.get(x);
            if (!wsAdapter) {
                return;
            }

            wsAdapter.emit(
                Nip05SocialRelayConnectionEvent.ProcessEventToClient,
                event
            );
        });
    }
}

