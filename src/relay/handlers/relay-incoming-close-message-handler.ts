import { IMessageHandler } from "../@types/message-handlers";
import { Incoming_CLOSE_Message } from "../@types/messages";
import {
    RelayWebSocketAdapter,
    RelayWebSocketAdapterEvent,
} from "../adapters/relay-web-socket-adapter";

export class RelayIncoming_CLOSE_MessageHandler implements IMessageHandler {
    constructor(private readonly wsAdapter: RelayWebSocketAdapter) {}

    async handleMessage(message: Incoming_CLOSE_Message) {
        const subscriptionId = message[1];

        this.wsAdapter.emit(
            RelayWebSocketAdapterEvent.Unsubscribe,
            subscriptionId
        );
    }
}

