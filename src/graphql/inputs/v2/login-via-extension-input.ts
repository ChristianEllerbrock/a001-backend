import { ArgsType, Field } from "type-graphql";

@ArgsType()
export class LoginViaExtensionInput {
    @Field(() => String)
    pubkey!: string;

    @Field(() => String)
    deviceId!: string;
}

