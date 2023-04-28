import { Ctx, Query, Resolver } from "type-graphql";
import { SystemDomainOutput } from "../outputs/system-domain";
import { GraphqlContext } from "../type-defs";

@Resolver()
export class SystemResolver {
    @Query((returns) => [SystemDomainOutput])
    async systemDomains(
        @Ctx() context: GraphqlContext
    ): Promise<SystemDomainOutput[]> {
        const dbSystemDomains = await context.db.systemDomain.findMany({
            orderBy: {
                order: "asc",
            },
        });

        return dbSystemDomains;
    }
}

