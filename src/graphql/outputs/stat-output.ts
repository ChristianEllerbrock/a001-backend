import { Field, Int, ObjectType } from "type-graphql";

@ObjectType("StatOutput", { isAbstract: true, simpleResolvers: true })
export class StatOutput {
    @Field((type) => Date)
    noOfLookupsDate!: Date;

    @Field(type => Int)
    noOfLookups!: number;

    @Field((type) => Date)
    noOfUsersDate!: Date;

    @Field(type => Int)
    noOfUsers!: number;
}