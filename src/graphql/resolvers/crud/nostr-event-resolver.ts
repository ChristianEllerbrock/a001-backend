import { Args, Ctx, Query, Resolver } from "type-graphql";
import { NostrEventOutput } from "../../outputs/nostr-event-output";
import { GraphqlContext } from "../../type-defs";
import { ProfileInputArgs } from "../../inputs/profile-input";
import { NostrHelperV2 } from "../../../nostr/nostr-helper-2";
import { Nip05NostrService } from "../../../services/nip05-nostr/nip05-nostr-service";

@Resolver()
export class NostrEventResolver {
    @Query((returns) => NostrEventOutput, { nullable: true })
    async profile(
        @Ctx() context: GraphqlContext,
        @Args() args: ProfileInputArgs
    ): Promise<NostrEventOutput | null> {
        if (!args.pubkey && !args.nip05) {
            throw new Error("You have to provide either a pubkey or a nip05.");
        }

        if (!args.pubkey) {
            throw new Error("Currently you have to provide a pubkey.");
        }

        const pubkeyHex = NostrHelperV2.getNostrPubkeyObject(args.pubkey).hex;

        const relays =
            await Nip05NostrService.instance.getRelevantAccountRelays(
                pubkeyHex
            );

        const event =
            await Nip05NostrService.instance.dmWatcher.fetchReplaceableEvent(
                pubkeyHex,
                [0],
                relays
            );

        if (!event) {
            return null;
        }

        return {
            id: event.id,
            pubkey: event.pubkey,
            kind: event.kind,
            createdAt: event.created_at,
            value: JSON.stringify(event),
            isEot: true,
        };
    }
}

