import { ArgsType, Field, Int } from "type-graphql";

@ArgsType()
export class SubscriptionCalcInput {
    @Field((type) => Int)
    subscriptionId!: number;

    @Field((type) => Int)
    days!: number;
}

