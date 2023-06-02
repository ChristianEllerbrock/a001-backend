import { Field, Int, ObjectType } from "type-graphql";
import { RegistrationStatisticsOutput } from "./statistics/registration-statistics-output";
import { LookupStatisticsOutput } from "./statistics/lookup-statistics-output";

@ObjectType("RegistrationsPerDomainStatisticsOutput")
export class RegistrationsPerDomainStatisticsOutput {
    @Field((type) => String)
    domain!: string;

    @Field((type) => Int)
    registrations!: number;
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

    @Field((type) => [RegistrationsPerDomainStatisticsOutput])
    registrationsPerDomain!: RegistrationsPerDomainStatisticsOutput[];
}

