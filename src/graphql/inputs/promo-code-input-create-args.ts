import { ArgsType, Field, Int } from "type-graphql";

@ArgsType()
export class PromoCodeInputCreateArgs {
    @Field((type) => Int)
    sats!: number;

    @Field((type) => Int)
    validityInDays!: number;

    @Field((type) => String, { nullable: true })
    pubkey?: string | null;

    @Field((type) => String, { nullable: true })
    info?: string | null;
}

