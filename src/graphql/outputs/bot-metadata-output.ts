import { Field, Int, ObjectType } from "type-graphql";
import { BotMetadataRelayOutput } from "./bot-metadata-relay-output";

@ObjectType()
export class BotMetadataOutput {
    @Field((type) => Int)
    id!: number;

    @Field((type) => Date)
    createdAt!: Date;

    @Field((type) => String)
    nip05!: string;

    @Field((type) => String)
    name!: string;

    @Field((type) => String, { nullable: true })
    about!: string | null;

    @Field((type) => String, { nullable: true })
    picture!: string | null;

    @Field((type) => String, { nullable: true })
    banner!: string | null;

    // Relations

    @Field((type) => [BotMetadataRelayOutput])
    botMetadataRelays?: BotMetadataRelayOutput[];
}

