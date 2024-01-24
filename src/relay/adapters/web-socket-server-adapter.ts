import { IncomingMessage } from "http";
import { WebSocket, WebSocketServer } from "ws";
import {
    RelayWebSocketAdapter,
    RelayWebSocketAdapterEvent,
} from "./relay-web-socket-adapter";
import { createLogger } from "./common";
import { RelayConfig } from "../config";
import { EventEmitter } from "stream";

const WSS_CLIENT_HEALTH_PROBE_INTERVAL = 120000;
const debug = createLogger("[Relay] - RelayWebSocketServerAdapter");

export enum RelayWebSocketServerAdapterEvent {
    BroadcastToClients = "BroadcastToClients",
}

export class RelayWebSocketServerAdapter extends EventEmitter {
    #webSocketAdapters = new WeakMap<WebSocket, RelayWebSocketAdapter>();
    #heartbeatInterval: NodeJS.Timer;

    constructor(
        private readonly webSocketServer: WebSocketServer,
        public readonly relayConfig: RelayConfig //private readonly webSocketAdapter: WebSocketAdapter
    ) {
        super();
        this.webSocketServer
            .on("connection", this.#onConnection.bind(this))
            .on("error", (error) => {
                debug(`error: ${error}`);
            });

        this.on(
            RelayWebSocketServerAdapterEvent.BroadcastToClients,
            this.#broadcastToClients.bind(this)
        );
        this.#heartbeatInterval = setInterval(
            this.#onHeartbeat.bind(this),
            WSS_CLIENT_HEALTH_PROBE_INTERVAL
        );
    }

    async #onConnection(client: WebSocket, req: IncomingMessage) {
        //console.log(req.socket);

        debug(`connect: ${req.socket.remoteAddress}`);

        // Todo: Disconnect limited clients

        this.#webSocketAdapters.set(
            client,
            new RelayWebSocketAdapter(client, req, this)
        );
        // todo
    }

    #onHeartbeat() {
        //
    }

    #broadcastToClients(event: Event) {
        this.webSocketServer.clients.forEach((x) => {
            if (x.readyState !== WebSocket.OPEN) {
                return;
            }

            const wsAdapter = this.#webSocketAdapters.get(x);
            if (!wsAdapter) {
                return;
            }

            wsAdapter.emit(
                RelayWebSocketAdapterEvent.ProcessEventToClient,
                event
            );
        });
    }
}

