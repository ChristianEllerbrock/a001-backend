import { Field, Int, ObjectType } from "type-graphql";

@ObjectType()
export class LookupStatisticsOutput {
    @Field((type) => String)
    identifier!: string;

    @Field((type) => String)
    domain!: string;

    @Field((type) => Int)
    total!: number;

    @Field((type) => String)
    pubkey!: string;
}

