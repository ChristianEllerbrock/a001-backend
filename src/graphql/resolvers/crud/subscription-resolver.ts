import {
    Arg,
    Args,
    Authorized,
    Ctx,
    Mutation,
    Query,
    Resolver,
} from "type-graphql";
import { SubscriptionOutput } from "../../outputs/subscriptionOutput";
import { GraphqlContext } from "../../type-defs";
import { ChangeSubscriptionInput } from "../../inputs/change-subscription-input";
import { SubscriptionCalc } from "../../../common/subscription-calc";
import { UserOutput } from "../../outputs/user-output";
import { UserSubscriptionOutput } from "../../outputs/user-subscription-output";
import { Nip05NostrService } from "../../../services/nip05-nostr/nip05-nostr-service";
import { Subscription } from "@prisma/client";
import { DateTime } from "luxon";
import { AlbyService } from "../../../services/alby-service";
import { PrismaService } from "../../../services/prisma-service";

@Resolver()
export class SubscriptionResolver {
    @Query((returns) => [SubscriptionOutput])
    async subscriptions(
        @Ctx() context: GraphqlContext
    ): Promise<SubscriptionOutput[]> {
        return await context.db.subscription.findMany({});
    }

    @Query((returns) => SubscriptionOutput, { nullable: true })
    async subscription(
        @Ctx() context: GraphqlContext,
        @Arg("id") id: number
    ): Promise<SubscriptionOutput | null> {
        return await context.db.subscription.findUnique({
            where: { id },
        });
    }
}

