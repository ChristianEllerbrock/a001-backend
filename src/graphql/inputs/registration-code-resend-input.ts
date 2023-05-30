import { ArgsType, Field, Int } from "type-graphql";

@ArgsType()
export class RegistrationCodeResendInput {
    @Field((type) => String)
    registrationId!: string;

    @Field((type) => String)
    userId!: string;

    @Field((type) => String)
    pubkey!: string;

    @Field((type) => String)
    jobId!: string;

    @Field((type) => String, { nullable: true })
    relay?: string;
}

