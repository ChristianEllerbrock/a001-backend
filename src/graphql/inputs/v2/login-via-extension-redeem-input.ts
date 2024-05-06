import { ArgsType, Field } from "type-graphql";
import { Nip07RedeemInput } from "../nip07RedeemInput";

@ArgsType()
export class LoginViaExtensionRedeemInput {
    @Field(() => String)
    deviceId!: string;

    @Field(() => Nip07RedeemInput)
    data!: Nip07RedeemInput;
}

