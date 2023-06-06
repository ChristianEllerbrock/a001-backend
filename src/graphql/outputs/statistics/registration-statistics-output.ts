import { Field, ObjectType } from "type-graphql";

@ObjectType()
export class RegistrationStatisticsOutput {
    @Field((type) => Date)
    date!: Date;

    @Field((type) => String)
    identifier!: string;

    @Field((type) => String)
    domain!: string;

    @Field((type) => String)
    pubkey!: string;
}
