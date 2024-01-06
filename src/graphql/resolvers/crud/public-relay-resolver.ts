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
import { PublicRelayOutput } from "../../outputs/public-relay-output";
import { GraphqlContext, Role } from "../../type-defs";
import { PublicRelayInputCreateArgs } from "../../inputs/public-relay-input-create-args";
import { PublicRelayInputUpdateArgs } from "../../inputs/public-relay-input-update-args";

@Resolver()
export class PublicRelayResolver {
    @Authorized()
    @Query((returns) => [PublicRelayOutput])
    async publicRelays(
        @Ctx() context: GraphqlContext
    ): Promise<PublicRelayOutput[]> {
        return await context.db.publicRelay.findMany({});
    }

    @Authorized([Role.Admin])
    @Mutation((returns) => PublicRelayOutput)
    async admCreatePublicRelay(
        @Ctx() context: GraphqlContext,
        @Args() args: PublicRelayInputCreateArgs
    ): Promise<PublicRelayOutput> {
        return await context.db.publicRelay.create({
            data: {
                url: args.url,
                notes: args.notes,
                createdAt: new Date(),
                isActive: false,
            },
        });
    }

    @Authorized([Role.Admin])
    @Mutation((returns) => PublicRelayOutput)
    async admUpdatePublicRelay(
        @Ctx() context: GraphqlContext,
        @Args() args: PublicRelayInputUpdateArgs
    ): Promise<PublicRelayOutput> {
        const data: { [key: string]: any } = {};

        if (args.data.url != null) {
            data.url = args.data.url;
        }

        if (args.data.notes != null) {
            data.notes = args.data.notes;
        }

        if (args.data.isActive != null) {
            data.isActive = args.data.isActive;
        }

        return await context.db.publicRelay.update({
            where: { id: args.id },
            data,
        });
    }

    @Authorized([Role.Admin])
    @Mutation((returns) => PublicRelayOutput)
    async admDeletePublicRelay(
        @Ctx() context: GraphqlContext,
        @Arg("id", (type) => Int) id: number
    ): Promise<PublicRelayOutput> {
        return await context.db.publicRelay.delete({
            where: { id },
        });
    }
}

