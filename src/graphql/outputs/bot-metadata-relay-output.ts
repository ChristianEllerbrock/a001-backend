import { Field, Int, ObjectType } from "type-graphql";
import { BotMetadataOutput } from "./bot-metadata-output";

@ObjectType()
export class BotMetadataRelayOutput {
    @Field((type) => Int)
    id!: number;

    @Field((type) => Int)
    botMetadataId!: number;

    @Field((type) => Date)
    publishedAt!: Date;

    @Field((type) => String)
    url!: string;

    // Relations

    @Field((type) => BotMetadataOutput)
    botMetadata?: BotMetadataOutput;
}

