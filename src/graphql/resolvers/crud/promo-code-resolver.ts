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
import { PromoCodeOutput } from "../../outputs/promo-code-output";
import { GraphqlContext, Role } from "../../type-defs";
import { PromoCodeInputCreateArgs } from "../../inputs/promo-code-input-create-args";
import { v4 } from "uuid";
import { DateTime } from "luxon";

@Resolver()
export class PromoCodeResolver {
    static async deleteExpiredPromoCodes(context: GraphqlContext) {
        const now = new Date();
        await context.db.promoCode.deleteMany({
            where: {
                validUntil: {
                    lt: now,
                },
            },
        });
    }

    @Authorized([Role.Admin])
    @Query((returns) => [PromoCodeOutput])
    async admPromoCodes(
        @Ctx() context: GraphqlContext
    ): Promise<PromoCodeOutput[]> {
        return await context.db.promoCode.findMany({});
    }

    @Authorized([Role.Admin])
    @Mutation((returns) => PromoCodeOutput)
    async admCreatePromoCode(
        @Ctx() context: GraphqlContext,
        @Args() args: PromoCodeInputCreateArgs
    ): Promise<PromoCodeOutput> {
        const now = new Date();

        // First, delete all expired (not used) promo codes.
        await PromoCodeResolver.deleteExpiredPromoCodes(context);

        // Generate a random code that is not already in use.
        // Give this max 10 tries.
        let code: string | undefined;
        for (let i = 0; i < 10; i++) {
            code = v4().slice(0, 6);
            const existing = await context.db.promoCode.findUnique({
                where: { code: code },
            });
            if (!existing) {
                break;
            }
        }

        // If we could not generate a unique code, throw an error.
        if (!code) {
            throw new Error("Could not generate a unique code.");
        }

        const validUntil = DateTime.fromJSDate(now)
            .plus({
                days: args.validityInDays,
            })
            .toJSDate();

        // Generate the database record and return it.
        return await context.db.promoCode.create({
            data: {
                code: code,
                sats: args.sats,
                createdAt: now,
                validUntil: validUntil,
                pubkey: args.pubkey,
                info: args.info,
            },
        });
    }

    @Authorized([Role.Admin])
    @Mutation((returns) => Boolean)
    async admDeletePromoCode(
        @Ctx() context: GraphqlContext,
        @Arg("id", (type) => Int) id: number
    ): Promise<boolean> {
        await PromoCodeResolver.deleteExpiredPromoCodes(context);

        await context.db.promoCode.delete({
            where: {
                id,
            },
        });
        return true;
    }
}

