import { Args, Authorized, Ctx, Query, Resolver } from "type-graphql";
import { SubscriptionCalcOutput } from "../../outputs/subscription-calc-output";
import { GraphqlContext } from "../../type-defs";
import { SubscriptionCalcInput } from "../../inputs/subscription-calc-input";
import { SubscriptionCalc } from "../../../common/subscription-calc";

@Resolver()
export class SubscriptionCalcResolver {
    @Authorized()
    @Query((returns) => SubscriptionCalcOutput)
    async subscriptionCalc(
        @Ctx() context: GraphqlContext,
        @Args() args: SubscriptionCalcInput
    ): Promise<SubscriptionCalcOutput> {
        let promoCodeId: number | undefined;
        if (typeof args.promoCode !== "undefined" && args.promoCode !== null) {
            const dbPromoCode = await context.db.promoCode.findUnique({
                where: {
                    code: args.promoCode,
                },
            });

            if (!dbPromoCode) {
                throw new Error("Invalid PROMO CODE");
            }

            if (!!dbPromoCode.pubkey) {
                // The promo code is intended for a specific pubkey only.
                const dbUser = await context.db.user.findUnique({
                    where: {
                        id: context.user?.userId,
                    },
                });

                if (!dbUser) {
                    throw new Error(
                        "We could not find your account in the database"
                    );
                }

                if (dbUser.pubkey !== dbPromoCode.pubkey) {
                    throw new Error(
                        "This promo code is not valid for your account"
                    );
                }
            }

            promoCodeId = dbPromoCode.id;
        }

        return SubscriptionCalc.exec(
            context.user?.userId ?? "na",
            args.subscriptionId,
            args.days,
            promoCodeId
        );
    }
}

