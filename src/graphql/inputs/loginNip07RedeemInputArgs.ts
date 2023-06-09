import { ArgsType, Field, InputType, Int } from "type-graphql";
import { Nip07RedeemInput } from "./nip07RedeemInput";

@ArgsType()
export class LoginNip07RedeemInputArgs {
    @Field((type) => String)
    deviceId!: string;

    @Field((type) => Nip07RedeemInput)
    data!: Nip07RedeemInput;
}

