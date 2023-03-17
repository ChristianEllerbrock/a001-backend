import { Authorized, Ctx, FieldResolver, Resolver, Root } from "type-graphql";
import { Nostr } from "../../nostr/nostr";
import { RegistrationOutput } from "../outputs/registration-output";
import { UserOutput } from "../outputs/user-output";
import { GraphqlContext } from "../type-defs";

@Resolver(of => UserOutput)
export class UserResolverRelations {
    @Authorized()
    @FieldResolver(returns => String)
    npub(@Root() user: UserOutput): string {
        return Nostr.Pubkey2nPub(user.pubkey);
    }

    @Authorized()
    @FieldResolver(returns => [RegistrationOutput])
    async registrations(@Root() user: UserOutput, @Ctx() context: GraphqlContext): Promise<RegistrationOutput[]> {
        const dbRegistrations = context.db.registration.findMany({ where: { userId: user.id } });

        return (await dbRegistrations).sortBy(x => x.identifier);
    }
}