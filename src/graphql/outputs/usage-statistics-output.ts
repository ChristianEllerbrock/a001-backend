import { Field, Int, ObjectType } from "type-graphql";

@ObjectType("LookupStatisticsOutput")
export class LookupStatisticsOutput {
    @Field((type) => String)
    identifier!: string;

    @Field((type) => String)
    domain!: string;

    @Field((type) => Int)
    total!: number;
}

@ObjectType("RegistrationStatisticsOutput")
export class RegistrationStatisticsOutput {
    @Field((type) => Date)
    date!: Date;

    @Field((type) => String)
    identifier!: string;

    @Field((type) => String)
    domain!: string;
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

    @Field((type) => [LookupStatisticsOutput])
    topLookupsToday!: LookupStatisticsOutput[];

    @Field((type) => [RegistrationStatisticsOutput])
    lastRegistrations!: RegistrationStatisticsOutput[];
}

