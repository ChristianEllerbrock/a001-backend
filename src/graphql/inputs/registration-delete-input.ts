import { ArgsType, Field } from "type-graphql";

@ArgsType()
export class RegistrationDeleteInputArgs {
    @Field(type => String)
    registrationId!: string;
}