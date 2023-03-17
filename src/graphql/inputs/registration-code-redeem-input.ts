import { ArgsType, Field } from "type-graphql";

@ArgsType()
export class RegistrationCodeRedeemInput {
    @Field((type) => String)
    registrationId!: string;

    @Field((type) => String)
    userId!: string;

    @Field((type) => String)
    code!: string;
}

