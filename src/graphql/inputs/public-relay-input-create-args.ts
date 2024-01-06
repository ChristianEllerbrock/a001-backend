import { ArgsType, Field } from "type-graphql";

@ArgsType()
export class PublicRelayInputCreateArgs {
    @Field((type) => String)
    url!: string;

    @Field((type) => String, { nullable: true })
    notes!: string | null;
}

