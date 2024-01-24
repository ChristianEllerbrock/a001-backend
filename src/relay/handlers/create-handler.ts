import { IncomingMessage, MessageTypeFromClient } from "../@types/messages";
import { RelayWebSocketAdapter } from "../adapters/relay-web-socket-adapter";
import { RelayIncoming_CLOSE_MessageHandler } from "./relay-incoming-close-message-handler";
import { RelayIncoming_EVENT_MessageHandler } from "./relay-incoming-event-message-handler";
import { RelayIncoming_REQ_MessageHandler } from "./relay-incoming-req-message-handler";

export const createMessageHandler = function (
    message: IncomingMessage,
    wsAdapter: RelayWebSocketAdapter
) {
    switch (message[0]) {
        case MessageTypeFromClient.REQ:
            return new RelayIncoming_REQ_MessageHandler(wsAdapter);

        case MessageTypeFromClient.EVENT:
            return new RelayIncoming_EVENT_MessageHandler(wsAdapter);

        case MessageTypeFromClient.CLOSE:
            return new RelayIncoming_CLOSE_MessageHandler(wsAdapter);

        default:
            throw new Error(`Unknown message type: ${message[0]}`);
    }
};

