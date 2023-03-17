import { ArgsType, Field } from "type-graphql";

@ArgsType()
export class RegistrationCreateInput {
    @Field((type) => String)
    identifier!: string;

    @Field((type) => String)
    npub!: string;
}

