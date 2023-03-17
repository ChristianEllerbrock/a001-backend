import { Field, ObjectType } from "type-graphql";

@ObjectType("RegistrationRelayOutput", {
    isAbstract: true,
    simpleResolvers: true,
})
export class RegistrationRelayOutput {
    @Field((type) => String)
    id!: string;

    @Field((type) => String)
    registrationId!: string;

    @Field((type) => String)
    address!: string;
}

