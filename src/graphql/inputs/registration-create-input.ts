import { ArgsType, Field, Int } from "type-graphql";

@ArgsType()
export class RegistrationCreateInput {
    @Field((type) => String)
    identifier!: string;

    @Field((type) => Int)
    systemDomainId!: number;

    @Field((type) => String)
    npub!: string;
}

