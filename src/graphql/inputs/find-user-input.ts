import { ArgsType, Field } from "type-graphql";

@ArgsType()
export class FindUserInput {
    @Field((type) => String)
    userId!: string;
}

