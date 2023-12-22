import { Authorized, Ctx, FieldResolver, Resolver, Root } from "type-graphql";
import { RegistrationOutput } from "../outputs/registration-output";
import { UserOutput } from "../outputs/user-output";
import { GraphqlContext } from "../type-defs";
import { NostrHelperV2 } from "../../nostr/nostr-helper-2";
import { SubscriptionOutput } from "../outputs/subscriptionOutput";
import { UserSubscriptionOutput } from "../outputs/user-subscription-output";

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

    @Authorized()
    @FieldResolver((returns) => SubscriptionOutput)
    async subscription(
        @Root() user: UserOutput,
        @Ctx() context: GraphqlContext
    ): Promise<SubscriptionOutput> {
        const dbSubscription = await context.db.user
            .findUnique({
                where: {
                    id: user.id,
                },
            })
            .subscription();

        if (!dbSubscription) {
            throw new Error("Could not found subscription for user.");
        }

        return dbSubscription;
    }

    @Authorized()
    @FieldResolver((returns) => [UserSubscriptionOutput])
    async userSubscriptions(
        @Root() user: UserOutput,
        @Ctx() context: GraphqlContext
    ): Promise<UserSubscriptionOutput[]> {
        return await context.db.userSubscription.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
        });
    }
}

