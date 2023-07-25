import { ArgsType, Field } from "type-graphql";

@ArgsType()
export class LoginNip46CodeCreateInputArgs {
    @Field((type) => String)
    pubkey!: string;

    @Field((type) => String)
    deviceId!: string;
}

