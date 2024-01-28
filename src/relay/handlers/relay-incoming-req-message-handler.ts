import { Filter } from "nostr-tools";
import { IMessageHandler } from "../@types/message-handlers";
import { Incoming_REQ_Message } from "../@types/messages";
import { RelayEventRepository } from "../repositories/relay-event-repository";
import { isEventMatchingFilter } from "../utils/event";
import {
    createOutgoing_EOSE_Message,
    createOutgoing_EVENT_Message,
} from "../utils/messages";
import { createLogger } from "../utils/common";
import {
    Nip05SocialRelayConnection,
    Nip05SocialRelayConnectionEvent,
} from "../nip05-social-relay-connection";

const debug = createLogger("[Relay] - (REQ)MessageHandler");

export class RelayIncoming_REQ_MessageHandler implements IMessageHandler {
    constructor(private readonly wsAdapter: Nip05SocialRelayConnection) {}

    async handleMessage(message: Incoming_REQ_Message): Promise<void> {
        const subscriptionId = message[1];
        const filters = message.slice(2);

        this.wsAdapter.emit(
            Nip05SocialRelayConnectionEvent.Subscribe,
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
                    Nip05SocialRelayConnectionEvent.SendMessageToClient,
                    createOutgoing_EVENT_Message(subscriptionId, x)
                );
            });

            this.wsAdapter.emit(
                Nip05SocialRelayConnectionEvent.SendMessageToClient,
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

