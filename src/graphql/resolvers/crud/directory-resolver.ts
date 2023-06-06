import { Ctx, Query, Resolver } from "type-graphql";
import { DirectoryRegistrationOutput } from "../../outputs/directory-registration-output";
import { GraphqlContext } from "../../type-defs";

@Resolver()
export class DirectoryResolver {
    @Query((returns) => [DirectoryRegistrationOutput])
    async directoryRegistrations(
        @Ctx() context: GraphqlContext
    ): Promise<DirectoryRegistrationOutput[]> {
        const dbRegistrations = await context.db.registration.findMany({
            include: {
                user: true,
                systemDomain: true,
            },
            orderBy: {
                nipped: "desc",
            },
        });

        const directoryRegistrationOutputs: DirectoryRegistrationOutput[] = [];

        for (let dbRegistration of dbRegistrations.filter(
            (x) => !x.user.isSystemAgent
        )) {
            directoryRegistrationOutputs.push({
                name: dbRegistration.identifier,
                domain: dbRegistration.systemDomain.name,
                lookups: dbRegistration.nipped,
                pubkey: dbRegistration.user.pubkey,
            });
        }

        return directoryRegistrationOutputs;
    }
}

