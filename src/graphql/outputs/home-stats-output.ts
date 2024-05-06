import { Field, Int, ObjectType } from "type-graphql";

@ObjectType()
export class HomeStatsOutput {
    @Field(() => Int)
    users!: number;

    @Field(() => Int)
    lookups!: number;
}

