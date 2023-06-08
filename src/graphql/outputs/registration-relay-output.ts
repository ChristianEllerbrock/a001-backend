import { Field, ObjectType } from "type-graphql";

@ObjectType()
export class RegistrationRelayOutput {
    @Field((type) => String)
    id!: string;

    @Field((type) => String)
    registrationId!: string;

    @Field((type) => String)
    address!: string;
}

