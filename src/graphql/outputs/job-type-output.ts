import { Field, Int, ObjectType } from "type-graphql";

@ObjectType()
export class JobTypeOutput {
    @Field((type) => Int)
    id!: number;

    @Field((type) => String)
    name!: string;
}

