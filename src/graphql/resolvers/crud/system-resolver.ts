import { Ctx, Query, Resolver } from "type-graphql";
import { SystemDomainOutput } from "../../outputs/system-domain";
import { GraphqlContext } from "../../type-defs";
import { SystemRelayOutput } from "../../outputs/system-relay-output";

@Resolver()
export class SystemResolver {
    @Query((returns) => [SystemDomainOutput])
    async systemDomains(
        @Ctx() context: GraphqlContext
    ): Promise<SystemDomainOutput[]> {
        return await context.db.systemDomain.findMany({
            orderBy: {
                order: "asc",
            },
        });
    }

    @Query((returns) => [SystemRelayOutput])
    async systemRelays(
        @Ctx() context: GraphqlContext
    ): Promise<SystemRelayOutput[]> {
        return await context.db.systemRelay.findMany({
            orderBy: {
                url: "asc",
            },
        });
    }
}

