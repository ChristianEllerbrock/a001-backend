import { Event, Filter } from "nostr-tools";
import { Range } from "./base";
import { SubscriptionId } from "./subscription";
import { EventId } from "./events";

export enum MessageTypeFromClient {
    REQ = "REQ",
    EVENT = "EVENT",
    CLOSE = "CLOSE",
    NOTICE = "NOTICE",
    EOSE = "EOSE",
    OK = "OK",
    AUTH = "AUTH",
}

export enum MessageTypeFromRelay {
    EVENT = "EVENT",
    CLOSED = "CLOSED",
    OK = "OK",
    NOTICE = "NOTICE",
    EOSE = "EOSE",
}

export type IncomingMessage =
    | Incoming_REQ_Message
    | Incoming_EVENT_Message
    | Incoming_CLOSE_Message;
// & {
//     [ContextMetadataKey]?: ContextMetadata;
// }

export type Incoming_REQ_Message = {
    0: MessageTypeFromClient.REQ;
    1: SubscriptionId;
} & {
    [index in Range<2, 100>]: Filter;
} & Array<Filter>;

export type Incoming_EVENT_Message = {
    0: MessageTypeFromClient.EVENT;
    1: Event;
};

export interface Incoming_CLOSE_Message {
    0: MessageTypeFromClient.CLOSE;
    1: SubscriptionId;
}

// export type IncomingRelayedEventMessage = [
//     MessageType.EVENT,
//     RelayedEvent,
//     Secret
// ];

// export interface EventMessage {
//     0: MessageType.EVENT;
//     1: Event;
//     2?: Secret;
// }

export type OutgoingMessage =
    | Outgoing_EVENT_Message
    | Outgoing_NOTICE_Message
    | Outgoing_OK_Message
    | Outgoing_EOSE_Message;

export interface Outgoing_EVENT_Message {
    0: MessageTypeFromRelay.EVENT;
    1: SubscriptionId;
    2: Event;
}

export interface Outgoing_NOTICE_Message {
    0: MessageTypeFromRelay.NOTICE;
    1: string;
}

export interface Outgoing_OK_Message {
    0: MessageTypeFromRelay.OK;
    1: EventId;
    2: boolean;
    3: string;
}

export interface Outgoing_EOSE_Message {
    0: MessageTypeFromRelay.EOSE;
    1: SubscriptionId;
}

