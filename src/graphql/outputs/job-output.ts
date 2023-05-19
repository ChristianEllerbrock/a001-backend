import { Field, Int, ObjectType } from "type-graphql";
import { UserOutput } from "./user-output";
import { JobStateOutput } from "./job-state-output";
import { JobTypeOutput } from "./job-type-output";

@ObjectType()
export class Job {
    @Field((type) => String)
    id!: string;

    @Field((type) => String)
    userId!: string;

    @Field((type) => Date)
    createdAt!: Date;

    @Field((type) => Date, { nullable: true })
    finishedAt!: Date | null;

    @Field((type) => Boolean, { nullable: true })
    finishedOk!: boolean | null;

    @Field((type) => String, { nullable: true })
    message!: string | null;

    @Field((type) => Int, { nullable: true })
    durationInSeconds!: number | null;

    @Field((type) => Int)
    jobStateId!: number;

    @Field((type) => Int)
    jobTypeId!: number;

    // relations
    @Field((type) => UserOutput)
    user?: UserOutput;

    @Field((type) => JobStateOutput)
    jobState?: JobStateOutput;

    @Field((type) => JobTypeOutput)
    jobType?: JobTypeOutput;
}

