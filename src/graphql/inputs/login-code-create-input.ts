import { ArgsType, Field } from "type-graphql";

@ArgsType()
export class LoginCodeCreateInputArgs {
    @Field((type) => String)
    pubkey!: string;

    @Field((type) => String)
    relay!: string;
}

