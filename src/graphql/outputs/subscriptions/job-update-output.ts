import { Field, Int, ObjectType } from "type-graphql";

@ObjectType()
export class JobUpdateOutput {
    @Field((type) => String)
    jobId!: string;

    @Field((type) => String)
    relay!: string;

    @Field((type) => Boolean)
    success!: boolean;

    @Field((type) => Int)
    item!: number;

    @Field((type) => Int)
    ofItems!: number;
}

