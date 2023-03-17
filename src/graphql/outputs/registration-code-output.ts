import { Field, ObjectType } from "type-graphql";
import { RegistrationOutput } from "./registration-output";

@ObjectType("RegistrationCodeOutput", {
    isAbstract: true,
    simpleResolvers: true,
})
export class RegistrationCodeOutput {
    @Field((type) => String)
    id!: string;

    @Field((type) => String)
    registrationId!: string;

    @Field((type) => String)
    code!: string;

    @Field((type) => Date)
    createdAt!: Date;

    @Field((type) => Date)
    validUntil!: Date;

    // Model Relations

    @Field((type) => RegistrationOutput)
    registration?: RegistrationOutput;
}

