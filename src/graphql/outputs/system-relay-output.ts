import { Field, Int, ObjectType } from "type-graphql";

@ObjectType()
export class SystemRelayOutput {
    @Field((type) => Int)
    id!: number;

    @Field((type) => String)
    url!: string;

    @Field((type) => Boolean)
    isActive!: boolean;
}
