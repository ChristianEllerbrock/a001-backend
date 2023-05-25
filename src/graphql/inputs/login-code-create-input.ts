import { ArgsType, Field } from "type-graphql";

@ArgsType()
export class LoginCodeCreateInputArgs {
    @Field((type) => String)
    pubkey!: string;

    @Field((type) => String, { nullable: true })
    relay?: string;

    @Field((type) => String)
    jobId!: string;
}

