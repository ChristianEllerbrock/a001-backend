import { Field, Int, ObjectType } from "type-graphql";

@ObjectType()
export class SubscriptionOutput {
    @Field((type) => Int)
    id!: number;

    @Field((type) => String)
    name!: string;

    @Field((type) => Int)
    satsPer30Days!: number;

    @Field((type) => Int)
    maxNoOfNostrAddresses!: number;

    @Field((type) => Int)
    maxNoOfInboundEmailsPer30Days!: number;

    @Field((type) => Int)
    maxNoOfOutboundEmailsPer30Days!: number;
}

