import { Field, Int, ObjectType } from "type-graphql";

@ObjectType()
export class DirectoryRegistrationOutput {
    @Field((type) => String)
    name!: string;

    @Field((type) => String)
    domain!: string;

    @Field((type) => String)
    pubkey!: string;

    @Field((type) => Int)
    lookups!: number;
}

