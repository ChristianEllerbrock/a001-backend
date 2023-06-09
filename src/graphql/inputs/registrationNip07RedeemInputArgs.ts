import { ArgsType, Field } from "type-graphql";
import { Nip07RedeemInput } from "./nip07RedeemInput";

@ArgsType()
export class RegistrationNip07RedeemInputArgs {
    @Field((type) => String)
    deviceId!: string;

    @Field((type) => String)
    registrationId!: string;

    @Field((type) => Nip07RedeemInput)
    data!: Nip07RedeemInput;
}
