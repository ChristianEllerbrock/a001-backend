import { Args, Resolver, Root, Subscription } from "type-graphql";
import { NostrEventOutput } from "../../outputs/nostr-event-output";
import { SubscribeToNostrEventArgs } from "../args/subscribe-to-profile-nostr-event-args";
import { SubscribeToNostrEventPayload } from "../payloads/subscribe-to-profile-nostr-event-payload";

@Resolver()
export class NostrEventSubscriptionResolver {
    @Subscription((returns) => NostrEventOutput, {
        topics: ["PROFILE_NOSTR_EVENT"],
        filter: (call: {
            args: SubscribeToNostrEventArgs;
            payload: SubscribeToNostrEventPayload;
        }) => {
            return call.args.subscriptionId ===
                call.payload.destinationFilter.subscriptionId
                ? true
                : false;
        },
    })
    async subscribeToNostrEvent(
        @Args() args: SubscribeToNostrEventArgs,
        @Root() payload: SubscribeToNostrEventPayload
    ): Promise<NostrEventOutput> {
        return payload.nostrEvent;
    }
}

