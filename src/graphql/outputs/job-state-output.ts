import { Field, Int, ObjectType } from "type-graphql";

@ObjectType()
export class JobStateOutput {
    @Field((type) => Int)
    id!: number;

    @Field((type) => String)
    name!: string;
}
