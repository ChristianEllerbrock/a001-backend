import { ArgsType, Field } from "type-graphql";

@ArgsType()
export class ProfileInputArgs {
    @Field((type) => String, { nullable: true })
    pubkey?: string;

    @Field((type) => String, { nullable: true })
    nip05?: string;

    @Field((type) => String)
    subscriptionId!: string;
}

