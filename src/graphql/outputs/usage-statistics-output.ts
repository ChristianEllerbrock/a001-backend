import { Field, Int, ObjectType } from "type-graphql";

@ObjectType("RegistrationLookupStatisticsOutput")
export class RegistrationLookupStatisticsOutput {
    @Field((type) => String)
    identifier!: string;

    @Field((type) => String)
    domain!: string;

    @Field((type) => Int)
    total!: number;
}

@ObjectType("UsageStatisticsOutput")
export class UsageStatisticsOutput {
    @Field((type) => Date)
    date!: Date;

    @Field((type) => Int)
    noOfUsers!: number;

    @Field((type) => Int)
    noOfRegistrations!: number;

    @Field((type) => Int)
    noOfLookupsYesterday!: number;

    @Field((type) => Int)
    noOfLookupsToday!: number;

    @Field((type) => [RegistrationLookupStatisticsOutput])
    lookups!: RegistrationLookupStatisticsOutput[];
}

