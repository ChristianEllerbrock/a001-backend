import { ArgsType, Field } from "type-graphql";

@ArgsType()
export class LoginViaDMInput {
    @Field(() => String)
    pubkey!: string;

    @Field(() => [String])
    relays!: string[];
}

