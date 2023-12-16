import { Field, Int, ObjectType } from "type-graphql";
import { UserSubscriptionInvoiceOutput } from "./user-subscription-invoice-output";

@ObjectType()
export class UserSubscriptionInvoicePaymentOutput {
    @Field((type) => Int)
    id!: number;

    @Field((type) => Int)
    userSubscriptionInvoiceId!: number;

    @Field((type) => Boolean, { nullable: true })
    settled!: boolean | null;

    @Field((type) => Date, { nullable: true })
    settledAt!: Date | null;

    // Relations
    @Field((type) => UserSubscriptionInvoiceOutput)
    userSubscriptionInvoice?: UserSubscriptionInvoiceOutput;
}

