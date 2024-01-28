import { IMessageHandler } from "../@types/message-handlers";
import { Incoming_CLOSE_Message } from "../@types/messages";
import {
    Nip05SocialRelayConnection,
    Nip05SocialRelayConnectionEvent,
} from "../nip05-social-relay-connection";

export class RelayIncoming_CLOSE_MessageHandler implements IMessageHandler {
    constructor(private readonly wsAdapter: Nip05SocialRelayConnection) {}

    async handleMessage(message: Incoming_CLOSE_Message) {
        const subscriptionId = message[1];

        this.wsAdapter.emit(
            Nip05SocialRelayConnectionEvent.Unsubscribe,
            subscriptionId
        );
    }
}

