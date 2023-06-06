import { ArgsType, Field } from "type-graphql";

@ArgsType()
export class SubscribeToNostrEventArgs {
    @Field((type) => String)
    subscriptionId!: string;
}

