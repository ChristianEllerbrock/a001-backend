import { Args, Ctx, Query, Resolver } from "type-graphql";
import { SubscriptionCalcOutput } from "../../outputs/subscription-calc-output";
import { GraphqlContext } from "../../type-defs";
import { SubscriptionCalcInput } from "../../inputs/subscription-calc-input";
import { SubscriptionCalc } from "../../../common/subscription-calc";

@Resolver()
export class SubscriptionCalcResolver {
    @Query((returns) => SubscriptionCalcOutput)
    async subscriptionCalc(
        @Ctx() context: GraphqlContext,
        @Args() args: SubscriptionCalcInput
    ): Promise<SubscriptionCalcOutput> {
        return SubscriptionCalc.exec(
            args.userId,
            args.subscriptionId,
            args.days
        );
    }
}

