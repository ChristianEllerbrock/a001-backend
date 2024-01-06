import { ArgsType, Field, InputType, Int } from "type-graphql";

@InputType()
export class PublicRelayInputUpdate {
    @Field((type) => String, { nullable: true })
    url!: string | null;

    @Field((type) => String, { nullable: true })
    notes!: string | null;

    @Field((type) => Boolean, { nullable: true })
    isActive!: boolean | null;
}

@ArgsType()
export class PublicRelayInputUpdateArgs {
    @Field((type) => Int)
    id!: number;

    @Field((type) => PublicRelayInputUpdate)
    data!: PublicRelayInputUpdate;
}

