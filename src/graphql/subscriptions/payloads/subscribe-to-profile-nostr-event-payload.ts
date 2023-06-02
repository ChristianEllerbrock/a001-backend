import { NostrEventOutput } from "../../outputs/nostr-event-output";

export type SubscribeToNostrEventPayload = {
    nostrEvent: NostrEventOutput;

    destinationFilter: {
        subscriptionId: string;
    };
};

