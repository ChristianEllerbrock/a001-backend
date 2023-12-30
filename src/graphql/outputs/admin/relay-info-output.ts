import { Field, Int, ObjectType } from "type-graphql";

@ObjectType()
export class RelayInfoOutput {
    @Field((type) => String)
    url!: string;

    @Field((type) => String)
    status!: string;

    @Field((type) => Int)
    noOfWatchedPubkeys!: number;

    @Field((type) => Int)
    noOfDisconnects!: number;

    @Field((type) => String)
    averageTimeBetweenDisconnects!: string;

    @Field((type) => String)
    averageUptime!: string;
}

