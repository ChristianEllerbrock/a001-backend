import { ArgsType, Field } from "type-graphql";

@ArgsType()
export class BotMetadataInputCreateArgs {
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
}

