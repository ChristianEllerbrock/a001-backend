import { Field, Int, ObjectType } from "type-graphql";

@ObjectType()
export class LookupStatisticsOutput {
    @Field(() => String)
    identifier!: string;

    @Field(() => String)
    domain!: string;

    @Field(() => Int)
    total!: number;

    @Field(() => String)
    pubkey!: string;
}

