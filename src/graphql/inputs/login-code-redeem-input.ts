import { ArgsType, Field } from "type-graphql";

@ArgsType()
export class LoginCodeRedeemInput {
    @Field((type) => String)
    userId!: string;

    @Field((type) => String)
    code!: string;
}
