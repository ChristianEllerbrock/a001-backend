import { ArgsType, Field } from "type-graphql";

@ArgsType()
export class LoginCodeRedeemInput {
    @Field(() => String)
    userId!: string;

    @Field(() => String)
    deviceId!: string;

    @Field(() => String)
    code!: string;
}

