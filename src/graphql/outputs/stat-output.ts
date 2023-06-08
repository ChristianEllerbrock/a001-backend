import { Field, Int, ObjectType } from "type-graphql";

@ObjectType()
export class StatOutput {
    @Field((type) => Date)
    noOfLookupsDate!: Date;

    @Field((type) => Int)
    noOfLookups!: number;

    @Field((type) => Date)
    noOfUsersDate!: Date;

    @Field((type) => Int)
    noOfUsers!: number;
}
