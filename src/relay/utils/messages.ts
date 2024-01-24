import { Event } from "nostr-tools";
import { SubscriptionId } from "../@types/subscription";
import {
    MessageTypeFromRelay,
    Outgoing_EOSE_Message,
    Outgoing_EVENT_Message,
    Outgoing_NOTICE_Message,
    Outgoing_OK_Message,
} from "../@types/messages";

export const createOutgoing_EVENT_Message = (
    subscriptionId: SubscriptionId,
    event: Event
): Outgoing_EVENT_Message => {
    return [MessageTypeFromRelay.EVENT, subscriptionId, event];
};

export const createOutgoing_EOSE_Message = (
    subscriptionId: SubscriptionId
): Outgoing_EOSE_Message => {
    return [MessageTypeFromRelay.EOSE, subscriptionId];
};

export const createOutgoing_NOTICE_Message = (
    notice: string
): Outgoing_NOTICE_Message => {
    return [MessageTypeFromRelay.NOTICE, notice];
};

export const createOutgoing_OK_Message = (
    eventId: string,
    success: boolean,
    message: string
): Outgoing_OK_Message => {
    return [MessageTypeFromRelay.OK, eventId, success, message];
};

