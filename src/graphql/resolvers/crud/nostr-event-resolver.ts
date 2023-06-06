import { Args, Ctx, PubSub, PubSubEngine, Query, Resolver } from "type-graphql";
import { NostrEventOutput } from "../../outputs/nostr-event-output";
import { GraphqlContext } from "../../type-defs";
import { ProfileInputArgs } from "../../inputs/profile-input";
import {
    NostrHelperV2,
    NostrPubkeyObject,
} from "../../../nostr/nostr-helper-2";
import {
    AgentRelayer,
    AgentRelayerRequestEvent,
} from "../../../nostr/agents/agent-relayer";
import { AgentRelayerService } from "../../../nostr/agents/agent-relayer-service";
import { v4 } from "uuid";
import { NostrEvent, NostrEventKind, NostrFilters } from "../../../nostr/nostr";
import { SubscribeToNostrEventPayload } from "../../subscriptions/payloads/subscribe-to-profile-nostr-event-payload";
import { PUBLISH_TOPICS } from "../../subscriptions/topics";

@Resolver()
export class NostrEventResolver {
    @Query((returns) => NostrEventOutput, { nullable: true })
    async profile(
        @Ctx() context: GraphqlContext,
        @Args() args: ProfileInputArgs,
        @PubSub() pubSub: PubSubEngine
    ): Promise<NostrEventOutput | null> {
        if (!args.pubkey && !args.nip05) {
            throw new Error("You have to provide either a pubkey or a nip05.");
        }

        if (!args.pubkey) {
            throw new Error("Currently you have to provide a pubkey.");
        }

        let pubkeyHex: string | undefined;
        try {
            pubkeyHex = NostrHelperV2.getNostrPubkeyObject(args.pubkey).hex;
        } catch (error) {
            throw new Error(
                "Invalid pubkey. Please provide the pubkey either in npub or hex representation."
            );
        }

        if (!pubkeyHex) {
            throw new Error(
                "Invalid pubkey. Please provide the pubkey either in npub or hex representation."
            );
        }

        const dbNostrEvent = await context.db.nostrEvent.findFirst({
            where: {
                kind: 0,
                pubkey: pubkeyHex,
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        const jobId = v4();
        await AgentRelayerService.instance.init();
        const ar = AgentRelayerService.instance.getAgentRelayer();
        const noOfRelays = ar?.relayClients.length ?? 0;
        let relayResponses = 0;
        let mostRecent: AgentRelayerRequestEvent | undefined;
        let mostRecentCreatedAt: number | undefined;

        const subscription = ar?.requestEvent.subscribe(async (event) => {
            if (event.jobId !== jobId) {
                return;
            }

            let lastLoop = false;

            relayResponses++;
            if (relayResponses === noOfRelays) {
                subscription?.unsubscribe();
                lastLoop = true;
            }

            if (event.success && event.messages.length > 0) {
                // Only process successful and not empty results
                const kind0Event = event.messages[0] as NostrEvent;

                let sendUpdate = false;

                if (mostRecentCreatedAt) {
                    // A more recent record than in the database exists.
                    if (kind0Event.created_at > mostRecentCreatedAt) {
                        mostRecent = event;
                        mostRecentCreatedAt = kind0Event.created_at;
                        sendUpdate = true;
                    }
                } else {
                    // A more recent record than in the database does NOT exist.
                    // Situation A: NO database record available
                    // Situation B: Database record available
                    if (
                        !dbNostrEvent ||
                        kind0Event.created_at > dbNostrEvent.createdAt
                    ) {
                        mostRecent = event;
                        mostRecentCreatedAt = kind0Event.created_at;
                        sendUpdate = true;
                    }
                }

                if (sendUpdate) {
                    const newDbNostrEvent = await context.db.nostrEvent.create({
                        data: {
                            id: kind0Event.id,
                            pubkey: pubkeyHex ?? "will not happen",
                            createdAt: kind0Event.created_at,
                            kind: NostrEventKind.Metadata,
                            value: JSON.stringify(kind0Event),
                        },
                    });

                    // TODO
                    console.log(mostRecent);
                    const payload: SubscribeToNostrEventPayload = {
                        destinationFilter: {
                            subscriptionId: args.subscriptionId,
                        },
                        nostrEvent: {
                            id: newDbNostrEvent.id,
                            pubkey: newDbNostrEvent.pubkey,
                            kind: newDbNostrEvent.kind,
                            createdAt: newDbNostrEvent.createdAt,
                            value: newDbNostrEvent.value,
                            isEot: false,
                        },
                    };

                    await pubSub.publish(
                        PUBLISH_TOPICS.PROFILE_NOSTR_EVENT,
                        payload
                    );
                }
            }

            if (lastLoop) {
                const payload: SubscribeToNostrEventPayload = {
                    destinationFilter: {
                        subscriptionId: args.subscriptionId,
                    },
                    nostrEvent: {
                        pubkey: pubkeyHex ?? "will not happen",
                        isEot: true,
                    },
                };

                await pubSub.publish(
                    PUBLISH_TOPICS.PROFILE_NOSTR_EVENT,
                    payload
                );
            }
        });

        const filters: NostrFilters = {
            authors: [pubkeyHex],
            kinds: [NostrEventKind.Metadata],
        };
        await AgentRelayerService.instance.request(filters, jobId);

        if (!dbNostrEvent) {
            return null;
        }

        return {
            id: dbNostrEvent.id,
            pubkey: dbNostrEvent.pubkey,
            kind: dbNostrEvent.kind,
            createdAt: dbNostrEvent.createdAt,
            value: dbNostrEvent.value,
            isEot: false,
        };
    }
}

