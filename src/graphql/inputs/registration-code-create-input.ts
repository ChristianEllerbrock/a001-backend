import { ArgsType, Field, Int } from "type-graphql";

@ArgsType()
export class RegistrationCodeCreateInput {
    @Field((type) => String)
    name!: string;

    @Field((type) => Int)
    systemDomainId!: number;

    @Field((type) => String)
    pubkey!: string;

    @Field((type) => String)
    jobId!: string;

    @Field((type) => String, { nullable: true })
    relay?: string;
}

