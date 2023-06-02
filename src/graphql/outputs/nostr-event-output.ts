import { Field, Int, ObjectType } from "type-graphql";

@ObjectType()
export class NostrEventOutput {
    @Field((type) => String)
    id!: string;

    @Field((type) => String)
    pubkey!: string;

    @Field((type) => Int)
    createdAt!: number;

    @Field((type) => Int)
    kind!: number;

    @Field((type) => String)
    value!: string;
}

