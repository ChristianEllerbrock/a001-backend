import { Field, Int, ObjectType } from "type-graphql";

@ObjectType()
export class NostrEventOutput {
    @Field((type) => String)
    pubkey!: string;

    @Field((type) => Boolean)
    isEot!: boolean;

    @Field((type) => String, { nullable: true })
    id?: string;

    @Field((type) => Int, { nullable: true })
    createdAt?: number;

    @Field((type) => Int, { nullable: true })
    kind?: number;

    @Field((type) => String, { nullable: true })
    value?: string;
}

