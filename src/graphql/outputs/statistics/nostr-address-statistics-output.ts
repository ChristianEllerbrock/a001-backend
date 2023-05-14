import { Field, Int, ObjectType } from "type-graphql";

@ObjectType()
export class NostrAddressStatisticsOutput {
    @Field((type) => String)
    id!: string;

    @Field((type) => Int)
    noOfLookups!: number;

    @Field((type) => Int)
    noOfLookupsToday!: number;

    @Field((type) => Int)
    noOfLookupsYesterday!: number;

    @Field((type) => Date, { nullable: true })
    lastLookupDate?: Date | null;
}

