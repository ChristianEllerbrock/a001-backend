import { Ctx, FieldResolver, Resolver, Root } from "type-graphql";
import { UserSubscriptionInvoiceOutput } from "../../outputs/user-subscription-invoice-output";
import { UserSubscriptionInvoicePaymentOutput } from "../../outputs/user-subscription-invoice-payment-output";
import { GraphqlContext } from "../../type-defs";

@Resolver((of) => UserSubscriptionInvoiceOutput)
export class UserSubscriptionInvoiceResolverRelations {
    @FieldResolver((returns) => UserSubscriptionInvoicePaymentOutput, {
        nullable: true,
    })
    async userSubscriptionInvoicePayment(
        @Root() userSubscriptionInvoice: UserSubscriptionInvoiceOutput,
        @Ctx() context: GraphqlContext
    ): Promise<UserSubscriptionInvoicePaymentOutput | null> {
        //
        const dbObject = await context.db.userSubscriptionInvoice.findFirst({
            where: { id: userSubscriptionInvoice.id },
            include: {
                userSubscriptionInvoicePayment: true,
                userSubscription: true,
            },
        });

        if (dbObject?.userSubscription.userId !== context.user?.userId) {
            throw new Error("Unauthorized.");
        }

        return dbObject?.userSubscriptionInvoicePayment ?? null;
    }
}

