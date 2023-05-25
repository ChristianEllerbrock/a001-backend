import { Authorized, Ctx, FieldResolver, Resolver, Root } from "type-graphql";
import { RegistrationOutput } from "../outputs/registration-output";
import { UserOutput } from "../outputs/user-output";
import { GraphqlContext } from "../type-defs";
import { NostrHelperV2 } from "../../nostr/nostr-helper-2";

@Resolver((of) => UserOutput)
export class UserResolverRelations {
    @Authorized()
    @FieldResolver((returns) => String)
    npub(@Root() user: UserOutput): string {
        return NostrHelperV2.pubkey2npub(user.pubkey);
    }

    @Authorized()
    @FieldResolver((returns) => [RegistrationOutput])
    async registrations(
        @Root() user: UserOutput,
        @Ctx() context: GraphqlContext
    ): Promise<RegistrationOutput[]> {
        const dbRegistrations = context.db.registration.findMany({
            where: {
                userId: user.id,
                verifiedAt: {
                    not: null,
                },
            },
        });

        return (await dbRegistrations).sortBy((x) => x.identifier);
    }
}

