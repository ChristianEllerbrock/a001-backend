import { IMessageHandler } from "../@types/message-handlers";
import { Incoming_EVENT_Message } from "../@types/messages";
import { createLogger } from "../adapters/common";
import {
    RelayWebSocketAdapter,
    RelayWebSocketAdapterEvent,
} from "../adapters/relay-web-socket-adapter";
import { RelayEventRepository } from "../repositories/relay-event-repository";
import { EventMeaning, getEventMeaning, isEventValid } from "../utils/event";
import { createOutgoing_OK_Message } from "../utils/messages";
import { Event } from "nostr-tools";

const debug = createLogger("[Relay] - (EVENT)MessageHandler");

export class RelayIncoming_EVENT_MessageHandler implements IMessageHandler {
    constructor(private readonly wsAdapter: RelayWebSocketAdapter) {}

    async handleMessage(message: Incoming_EVENT_Message) {
        const event = message[1];

        try {
            const ok = await this.#checkEvent(event);
            if (ok) {
                await this.#processEvent(event);
            }
        } catch (error) {
            debug(`Error: ${error}`);

            this.wsAdapter.emit(
                RelayWebSocketAdapterEvent.SendMessageToClient,
                createOutgoing_OK_Message(
                    event.id,
                    false,
                    "Error: unable to process event"
                )
            );
        }
    }

    async #checkEvent(event: Event): Promise<boolean> {
        // Check for validity.
        let reason = await isEventValid(event);
        if (reason) {
            debug(`event ${event.id} rejected: ${reason}`);
            this.wsAdapter.emit(
                RelayWebSocketAdapterEvent.SendMessageToClient,
                createOutgoing_OK_Message(event.id, false, reason)
            );
            return false;
        }

        // TODO: More checks

        return true;
    }

    async #processEvent(event: Event) {
        const meaning = getEventMeaning(event);
        let result = -1;

        if (event.kind === 5) {
            // Deletion event.
            await RelayEventRepository.instance.delete(event);
            result = await RelayEventRepository.instance.create(event);
        } else if (
            [
                EventMeaning.ReplaceableEvent,
                EventMeaning.ParameterizedReplaceableEvent,
            ].includes(meaning)
        ) {
            result = await RelayEventRepository.instance.upsert(event);
        } else if (meaning === EventMeaning.EphemeralEvent) {
            // Do NOT store event but forward it to all connected clients.
            result = 1;
        } else {
            // Default
            result = await RelayEventRepository.instance.create(event);
        }

        this.wsAdapter.emit(
            RelayWebSocketAdapterEvent.SendMessageToClient,
            createOutgoing_OK_Message(
                event.id,
                true,
                result === -1 ? "duplicate" : ""
            )
        );

        if (result === 1) {
            this.wsAdapter.emit(
                RelayWebSocketAdapterEvent.BroadcastToClients,
                event
            );
        }
    }
}

