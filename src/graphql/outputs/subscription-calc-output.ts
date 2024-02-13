import { Field, Int, ObjectType } from "type-graphql";

@ObjectType()
export class SubscriptionCalcOutput {
    @Field((type) => Int)
    subscriptionId!: number;

    @Field((type) => Date)
    subscriptionEnd!: Date;

    @Field((type) => Int)
    days!: number;

    @Field((type) => Int)
    amount!: number;

    @Field((type) => Int)
    promoAmount!: number;

    @Field((type) => Int)
    invoiceAmount!: number;
}

