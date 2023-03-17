import { ArgsType, Field } from "type-graphql";

@ArgsType()
export class RegistrationCodeCreateInput {
    @Field((type) => String)
    registrationId!: string;

    @Field((type) => String)
    userId!: string;

    @Field((type) => String)
    relay!: string;
}

