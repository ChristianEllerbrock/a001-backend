import { ArgsType, Field, InputType, Int } from "type-graphql";

@InputType()
export class LoginNip07RedeemInput {
    @Field((type) => String)
    id!: string;

    @Field((type) => String)
    pubkey!: string;

    @Field((type) => String)
    content!: string;

    @Field((type) => [[String]])
    tags!: string[][];

    @Field((type) => String)
    sig!: string;

    @Field((type) => Int)
    created_at!: number;

    @Field((type) => Int)
    kind!: number;
}

@ArgsType()
export class LoginNip07RedeemInputArgs {
    @Field((type) => String)
    deviceId!: string;

    @Field((type) => LoginNip07RedeemInput)
    data!: LoginNip07RedeemInput;
}

