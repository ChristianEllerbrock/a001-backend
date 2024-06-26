import { ArgsType, Field } from "type-graphql";

@ArgsType()
export class LoginViaDmInput {
    @Field(() => String)
    pubkey!: string;

    @Field(() => [String])
    relays!: string[];
}

