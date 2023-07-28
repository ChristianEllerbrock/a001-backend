import { ArgsType, Field } from "type-graphql";
import { Nip46RedeemInput } from "./nip46RedeemInput";

@ArgsType()
export class RegistrationNip46RedeemInputArgs {
    @Field((type) => String)
    deviceId!: string;

    @Field((type) => String)
    registrationId!: string;

    @Field((type) => Nip46RedeemInput)
    data!: Nip46RedeemInput;
}

