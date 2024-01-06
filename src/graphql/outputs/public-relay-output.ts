import { Field, Int, ObjectType } from "type-graphql";

@ObjectType()
export class PublicRelayOutput {
    @Field((type) => Int)
    id!: number;

    @Field((type) => String)
    url!: string;

    @Field((type) => Boolean)
    isActive!: boolean;

    @Field((type) => Date)
    createdAt!: Date;

    @Field((type) => String, { nullable: true })
    notes!: string | null;
}

