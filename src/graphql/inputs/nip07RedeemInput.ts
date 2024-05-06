import { Field, InputType, Int } from "type-graphql";

@InputType()
export class Nip07RedeemInput {
    @Field(() => String)
    id!: string;

    @Field(() => String)
    pubkey!: string;

    @Field(() => String)
    content!: string;

    @Field(() => [[String]])
    tags!: string[][];

    @Field(() => String)
    sig!: string;

    @Field(() => Int)
    created_at!: number;

    @Field(() => Int)
    kind!: number;
}

