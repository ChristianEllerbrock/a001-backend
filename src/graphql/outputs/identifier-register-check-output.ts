import { Field, ObjectType } from "type-graphql";

@ObjectType("IdentifierRegisterCheckOutput", {
    isAbstract: true,
    simpleResolvers: true,
})
export class IdentifierRegisterCheckOutput {
    @Field((type) => String)
    name!: string;

    @Field((type) => Boolean)
    canBeRegistered!: boolean;

    @Field((type) => String, { nullable: true })
    reason?: string;
}

