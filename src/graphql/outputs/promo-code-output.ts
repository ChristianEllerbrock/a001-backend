import { Field, Int, ObjectType } from "type-graphql";

@ObjectType()
export class PromoCodeOutput {
    @Field((type) => Int)
    id!: number;

    @Field((type) => String)
    code!: string;

    @Field((type) => Int)
    sats!: number;

    @Field((type) => Date)
    createdAt!: Date;

    @Field((type) => Date)
    validUntil!: Date;

    @Field((type) => String, { nullable: true })
    pubkey?: string | null;

    @Field((type) => String, { nullable: true })
    info?: string | null;
}

