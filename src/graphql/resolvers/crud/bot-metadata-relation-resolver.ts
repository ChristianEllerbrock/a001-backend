import { Ctx, FieldResolver, Resolver, Root } from "type-graphql";
import { BotMetadataOutput } from "../../outputs/bot-metadata-output";
import { BotMetadataRelayOutput } from "../../outputs/bot-metadata-relay-output";
import { GraphqlContext } from "../../type-defs";

@Resolver((of) => BotMetadataOutput)
export class BotMetadataRelationResolver {
    @FieldResolver((returns) => [BotMetadataRelayOutput])
    async botMetadataRelays(
        @Root() botMetadata: BotMetadataOutput,
        @Ctx() context: GraphqlContext
    ): Promise<BotMetadataRelayOutput[]> {
        return await context.db.botMetadataRelay.findMany({
            where: { botMetadataId: botMetadata.id },
        });
    }
}

