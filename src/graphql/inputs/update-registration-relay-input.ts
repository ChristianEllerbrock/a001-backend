import { ArgsType, Field, InputType } from "type-graphql";

@InputType("RelayInput")
export class RelayInput {
    @Field((type) => String)
    id!: string;

    @Field((type) => String)
    address!: string;
}

@InputType("UpdateRegistrationRelayInput")
export class UpdateRegistrationRelayInput {
    @Field((type) => [String])
    toBeDeletedIds!: string[];

    @Field((type) => [String])
    toBeAdded!: string[];

    @Field((type) => [RelayInput])
    toBeUpdated!: RelayInput[];
}

@ArgsType()
export class UpdateRegistrationRelayInputArgs {
    @Field((type) => String)
    registrationRelayId!: string;

    @Field((type) => String)
    address!: string;
}

