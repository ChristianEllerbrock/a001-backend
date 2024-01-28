import { IncomingMessage, MessageTypeFromClient } from "../@types/messages";
import { Nip05SocialRelayConnection } from "../nip05-social-relay-connection";
import { RelayIncoming_CLOSE_MessageHandler } from "./relay-incoming-close-message-handler";
import { RelayIncoming_EVENT_MessageHandler } from "./relay-incoming-event-message-handler";
import { RelayIncoming_REQ_MessageHandler } from "./relay-incoming-req-message-handler";

export const createMessageHandler = function (
    message: IncomingMessage,
    connection: Nip05SocialRelayConnection
) {
    switch (message[0]) {
        case MessageTypeFromClient.REQ:
            return new RelayIncoming_REQ_MessageHandler(connection);

        case MessageTypeFromClient.EVENT:
            return new RelayIncoming_EVENT_MessageHandler(connection);

        case MessageTypeFromClient.CLOSE:
            return new RelayIncoming_CLOSE_MessageHandler(connection);

        default:
            throw new Error(`Unknown message type: ${message[0]}`);
    }
};

