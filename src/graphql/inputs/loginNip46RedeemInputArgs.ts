import { ArgsType, Field, InputType, Int } from "type-graphql";
import { Nip46RedeemInput } from "./nip46RedeemInput";

@ArgsType()
export class LoginNip46RedeemInputArgs {
    @Field((type) => String)
    deviceId!: string;

    @Field((type) => Nip46RedeemInput)
    data!: Nip46RedeemInput;
}

