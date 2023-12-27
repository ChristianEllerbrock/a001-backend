import { Field, Int, ObjectType } from "type-graphql";
import { UserOutput } from "./user-output";
import { SubscriptionOutput } from "./subscriptionOutput";
import { UserSubscriptionInvoiceOutput } from "./user-subscription-invoice-output";

@ObjectType()
export class UserSubscriptionOutput {
    @Field((type) => Int)
    id!: number;

    @Field((type) => String)
    userId!: string;

    @Field((type) => Date)
    createdAt!: Date;

    @Field((type) => Boolean)
    pending!: boolean;

    @Field((type) => Boolean)
    cancelled!: boolean;

    @Field((type) => Int)
    oldSubscriptionId!: number;

    @Field((type) => Int)
    newSubscriptionId!: number;

    @Field((type) => Date, { nullable: true })
    newSubscriptionEnd!: Date | null;

    // Relations
    @Field((type) => UserOutput)
    user?: UserOutput;

    @Field((type) => SubscriptionOutput)
    oldSubscription?: SubscriptionOutput;

    @Field((type) => SubscriptionOutput)
    newSubscription?: SubscriptionOutput;

    @Field((type) => UserSubscriptionInvoiceOutput)
    userSubscriptionInvoice?: UserSubscriptionInvoiceOutput;
}

