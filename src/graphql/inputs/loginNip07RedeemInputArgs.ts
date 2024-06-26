import { ArgsType, Field } from "type-graphql";
import { Nip07RedeemInput } from "./nip07RedeemInput";

@ArgsType()
export class LoginNip07RedeemInputArgs {
    @Field(() => String)
    deviceId!: string;

    @Field(() => Nip07RedeemInput)
    data!: Nip07RedeemInput;
}

