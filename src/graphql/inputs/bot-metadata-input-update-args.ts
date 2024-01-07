import { ArgsType, Field, InputType, Int } from "type-graphql";

@InputType()
export class BotMetadataInputUpdate {
    @Field((type) => String, { nullable: true })
    nip05?: string;

    @Field((type) => String)
    name?: string;

    @Field((type) => String, { nullable: true })
    about?: string | null;

    @Field((type) => String, { nullable: true })
    picture?: string | null;

    @Field((type) => String, { nullable: true })
    banner?: string | null;
}

@ArgsType()
export class BotMetadataInputUpdateArgs {
    @Field((type) => Int)
    id!: number;

    @Field((type) => BotMetadataInputUpdate)
    data!: BotMetadataInputUpdate;
}

