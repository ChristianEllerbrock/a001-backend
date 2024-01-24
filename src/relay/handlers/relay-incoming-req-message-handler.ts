import { Event, Filter } from "nostr-tools";
import { IMessageHandler } from "../@types/message-handlers";
import { Incoming_REQ_Message } from "../@types/messages";
import {
    RelayWebSocketAdapter,
    RelayWebSocketAdapterEvent,
} from "../adapters/relay-web-socket-adapter";
import { RelayEventRepository } from "../repositories/relay-event-repository";
import { pipeline } from "stream/promises";
import { streamFilter } from "../utils/stream";
import { isEventMatchingFilter } from "../utils/event";
import {
    createOutgoing_EOSE_Message,
    createOutgoing_EVENT_Message,
    createOutgoing_NOTICE_Message,
} from "../utils/messages";
import { createLogger } from "../adapters/common";

const debug = createLogger("[Relay] - (REQ)MessageHandler");

export class RelayIncoming_REQ_MessageHandler implements IMessageHandler {
    constructor(private readonly wsAdapter: RelayWebSocketAdapter) {}

    async handleMessage(message: Incoming_REQ_Message): Promise<void> {
        const subscriptionId = message[1];
        const filters = message.slice(2);

        this.wsAdapter.emit(
            RelayWebSocketAdapterEvent.Subscribe,
            subscriptionId,
            filters
        );

        await this.#fetchFromRepoAndSend(subscriptionId, filters);
    }

    async #fetchFromRepoAndSend(subscriptionId: string, filters: Filter[]) {
        try {
            const events = await RelayEventRepository.instance.findByFilters(
                filters
            );

            const matchingEvents = events.filter((event) =>
                filters.some((x) => isEventMatchingFilter(x)(event))
            );
            matchingEvents.forEach((x) => {
                this.wsAdapter.emit(
                    RelayWebSocketAdapterEvent.SendMessageToClient,
                    createOutgoing_EVENT_Message(subscriptionId, x)
                );
            });

            this.wsAdapter.emit(
                RelayWebSocketAdapterEvent.SendMessageToClient,
                createOutgoing_EOSE_Message(subscriptionId)
            );
        } catch (error: any) {
            debug(
                `Error fetching data from database and sending them: ${error?.message}`
            );

            throw new Error("Error fetching data from the database");
        }
    }
}

