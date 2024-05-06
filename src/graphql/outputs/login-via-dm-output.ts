import { Field, ObjectType } from "type-graphql";

@ObjectType()
export class LoginViaDmOutput {
    @Field(() => String)
    userId!: string;

    @Field(() => [String])
    relays!: string[];
}

