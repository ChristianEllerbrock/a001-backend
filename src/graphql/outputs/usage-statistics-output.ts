import { Field, Int, ObjectType } from "type-graphql";
import { RegistrationStatisticsOutput } from "./statistics/registration-statistics-output";
import { LookupStatisticsOutput } from "./statistics/lookup-statistics-output";

@ObjectType()
export class RegistrationsPerDomainStatisticsOutput {
    @Field(() => String)
    domain!: string;

    @Field(() => Int)
    registrations!: number;
}

@ObjectType()
export class UsageStatisticsOutput {
    @Field(() => Date)
    date!: Date;

    @Field(() => Int)
    noOfUsers!: number;

    @Field(() => Int)
    noOfRegistrations!: number;

    @Field(() => Int)
    noOfLookupsTotal!: number;

    @Field(() => Int)
    noOfLookupsYesterday!: number;

    @Field(() => Int)
    noOfLookupsToday!: number;

    @Field(() => [LookupStatisticsOutput])
    topLookupsToday!: LookupStatisticsOutput[];

    @Field(() => [RegistrationStatisticsOutput])
    lastRegistrations!: RegistrationStatisticsOutput[];

    @Field(() => [RegistrationsPerDomainStatisticsOutput])
    registrationsPerDomain!: RegistrationsPerDomainStatisticsOutput[];
}

