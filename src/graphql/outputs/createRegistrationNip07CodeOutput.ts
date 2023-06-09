import { Field, ObjectType } from "type-graphql";

@ObjectType()
export class CreateRegistrationNip07CodeOutput {
    @Field((type) => String)
    registrationId!: string;

    @Field((type) => String)
    code!: string;
}

