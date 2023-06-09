import { Field, Int, ObjectType } from "type-graphql";

@ObjectType()
export class RegistrationLookupOutput {
    @Field((type) => Int)
    id!: number;

    @Field((type) => String)
    registrationId!: string;

    @Field((type) => Date)
    date!: Date;

    @Field((type) => Int)
    total!: number;
}

