import { Field, ObjectType } from "type-graphql";

@ObjectType()
export class RelayInfoOutput {
    @Field((type) => String)
    url!: string;

    @Field((type) => String)
    status!: string;

    @Field((type) => [String])
    watchedPubkeys!: string[];
}

