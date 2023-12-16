import { Field, Int, ObjectType } from "type-graphql";
import { UserSubscription } from "./user-subscription-output";
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

    @Field((type) => String)
    description!: string;

    @Field((type) => Date)
    expiredAt!: Date;

    @Field((type) => String)
    paymentHash!: string;

    @Field((type) => String)
    paymentRequest!: string;

    // Relations

    @Field((type) => UserSubscription)
    userSubscription?: UserSubscription;

    @Field((type) => UserSubscriptionInvoicePaymentOutput)
    userSubscriptionInvoicePayment!: UserSubscriptionInvoicePaymentOutput;
}

