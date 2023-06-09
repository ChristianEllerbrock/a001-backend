import { Field, InputType, Int } from "type-graphql";

@InputType()
export class Nip07RedeemInput {
    @Field((type) => String)
    id!: string;

    @Field((type) => String)
    pubkey!: string;

    @Field((type) => String)
    content!: string;

    @Field((type) => [[String]])
    tags!: string[][];

    @Field((type) => String)
    sig!: string;

    @Field((type) => Int)
    created_at!: number;

    @Field((type) => Int)
    kind!: number;
}

