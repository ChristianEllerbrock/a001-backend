import { Field, Int, ObjectType } from "type-graphql";
import { UserSubscriptionOutput } from "./user-subscription-output";
import { UserSubscriptionInvoicePaymentOutput } from "./user-subscription-invoice-payment-output";

@ObjectType()
export class UserSubscriptionInvoiceOutput {
    @Field((type) => Int)
    id!: number;

    @Field((type) => Int)
    userSubscriptionId!: number;

    @Field((type) => Date)
    createdAt!: Date;

    @Field((type) => Int)
    amount!: number;

    @Field((type) => String, { nullable: true })
    description!: string | null;

    @Field((type) => Date)
    expiredAt!: Date;

    @Field((type) => String)
    paymentHash!: string;

    @Field((type) => String)
    paymentRequest!: string;

    // Relations

    @Field((type) => UserSubscriptionOutput)
    userSubscription?: UserSubscriptionOutput;

    @Field((type) => UserSubscriptionInvoicePaymentOutput)
    userSubscriptionInvoicePayment?: UserSubscriptionInvoicePaymentOutput;
}

