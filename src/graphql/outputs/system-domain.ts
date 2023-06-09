import { Field, Int, ObjectType } from "type-graphql";

@ObjectType()
export class SystemDomainOutput {
    @Field((type) => Int)
    id!: number;

    @Field((type) => String)
    name!: string;

    @Field((type) => Int)
    order!: number;
}

