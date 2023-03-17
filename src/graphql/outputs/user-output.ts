import { Field, ObjectType } from "type-graphql";
import { RegistrationOutput } from "./registration-output";

@ObjectType("UserOutput", { isAbstract: true, simpleResolvers: true })
export class UserOutput {
    @Field((type) => String)
    id!: string;

    @Field((type) => String)
    pubkey!: string;

    @Field((type) => Date)
    createdAt!: Date;

    // Model Relations

    @Field((type) => [RegistrationOutput], { nullable: true })
    registrations?: RegistrationOutput[] | null;

    @Field(type => String)
    npub?: string;
}

