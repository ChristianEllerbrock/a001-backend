import {
    Arg,
    Args,
    Authorized,
    Ctx,
    Int,
    Mutation,
    Query,
    Resolver,
} from "type-graphql";
import { BotMetadataOutput } from "../../outputs/bot-metadata-output";
import { GraphqlContext, Role } from "../../type-defs";
import { BotMetadataInputCreateArgs } from "../../inputs/bot-metadata-input-create-args";
import { BotMetadataInputUpdateArgs } from "../../inputs/bot-metadata-input-update-args";
import { EventTemplate } from "nostr-tools";
import { Nip05NostrService } from "../../../services/nip05-nostr/nip05-nostr-service";
import { AzureSecretService } from "../../../services/azure-secret-service";
import {
    KeyVault_Bots_SecretName,
    KeyVault_Bots_Type,
} from "../../../common/key-vault";
import { NostrConnector } from "../../../nostr-v4/nostrConnector";

@Resolver()
export class BotMetadataResolver {
    @Authorized([Role.Admin])
    @Query((returns) => [BotMetadataOutput])
    async admBotMetadatas(
        @Ctx() context: GraphqlContext
    ): Promise<BotMetadataOutput[]> {
        return context.db.botMetadata.findMany({
            orderBy: { createdAt: "desc" },
        });
    }

    @Authorized([Role.Admin])
    @Mutation((returns) => BotMetadataOutput)
    async admCreateBotMetadata(
        @Ctx() context: GraphqlContext,
        @Args() args: BotMetadataInputCreateArgs
    ): Promise<BotMetadataOutput> {
        return await context.db.botMetadata.create({
            data: {
                createdAt: new Date(),
                nip05: args.nip05,
                name: args.name,
                about: args.about,
                picture: args.picture,
                banner: args.banner,
            },
        });
    }

    @Authorized([Role.Admin])
    @Mutation((returns) => BotMetadataOutput)
    async admUpdateBotMetadata(
        @Ctx() context: GraphqlContext,
        @Args() args: BotMetadataInputUpdateArgs
    ): Promise<BotMetadataOutput> {
        // Updating data is only possible if there are no publications to relays.
        const dbBotMetadataRelay = await context.db.botMetadataRelay.findFirst({
            where: { botMetadataId: args.id },
        });

        if (dbBotMetadataRelay) {
            throw new Error(
                "You already have published this record and therefore cannot make any changes. Please create a new record."
            );
        }

        return await context.db.botMetadata.update({
            where: { id: args.id },
            data: args.data,
        });
    }

    @Authorized([Role.Admin])
    @Mutation((returns) => BotMetadataOutput)
    async admPublishBotMetadata(
        @Ctx() context: GraphqlContext,
        @Arg("botMetadataId", (type) => Int) botMetadataId: number
    ): Promise<BotMetadataOutput> {
        const dbBotMetadata = await context.db.botMetadata.findUnique({
            where: { id: botMetadataId },
        });
        if (!dbBotMetadata) {
            throw new Error("No record found with the provided ID.");
        }

        const existingBotMetadataRelays = Array.from(
            new Set<string>(
                (
                    await context.db.botMetadataRelay.findMany({
                        where: { botMetadataId: botMetadataId },
                        select: { url: true },
                    })
                ).map((x) => x.url)
            )
        );

        const publicRelays = new Set<string>(
            (
                await context.db.publicRelay.findMany({
                    where: { isActive: true },
                    select: { url: true },
                })
            ).map((x) => x.url)
        );

        const emailNostrProfileRelays = new Set<string>(
            (
                await context.db.emailNostrProfile.findMany({
                    select: { publishedRelay: true },
                })
            ).map((x) => x.publishedRelay)
        );

        const allPossibleRelays = Array.from(
            new Set<string>([
                ...Array.from(publicRelays),
                ...Array.from(emailNostrProfileRelays),
            ])
        );

        const newRelays: string[] = [];
        for (const possibleRelay of allPossibleRelays) {
            if (existingBotMetadataRelays.includes(possibleRelay)) {
                continue;
            }

            newRelays.push(possibleRelay);
        }

        if (newRelays.empty()) {
            return dbBotMetadata; // Nothing to do here.
        }

        // Get the bot pubkey and privkey for the connector.
        const bots =
            await AzureSecretService.instance.tryGetValue<KeyVault_Bots_Type>(
                KeyVault_Bots_SecretName
            );
        const bot = bots?.find((x) => x.id === 1);
        if (typeof bot === "undefined") {
            throw new Error("Could not get bot data from Azure Key Vault.");
        }

        const connector = new NostrConnector({
            pubkey: bot.pubkey,
            privkey: bot.privkey,
        });

        const now = new Date();
        const eventTemplate: EventTemplate = {
            kind: 0,
            created_at: Math.floor(now.getTime() / 1000),
            content: JSON.stringify({
                name: dbBotMetadata.name,
                nip05: dbBotMetadata.nip05,
                about: dbBotMetadata.about ?? undefined,
                banner: dbBotMetadata.banner ?? undefined,
                picture: dbBotMetadata.picture,
            }),
            tags: [],
        };

        const event = connector.signEvent(eventTemplate);

        const publishedRelays = await Nip05NostrService.instance.publishEvent(
            event,
            newRelays
        );

        const data = publishedRelays.map((x) => {
            return {
                botMetadataId: botMetadataId,
                url: x,
                publishedAt: now,
            };
        });

        await context.db.botMetadataRelay.createMany({
            data,
        });

        return dbBotMetadata;
    }
}

