import { Field, Int, ObjectType } from "type-graphql";

@ObjectType()
export class SubscriptionCalcOutput {
    @Field((type) => Date)
    subscriptionEnd!: Date;

    @Field((type) => Int)
    days!: number;

    @Field((type) => Int)
    invoiceAmount!: number;
}

