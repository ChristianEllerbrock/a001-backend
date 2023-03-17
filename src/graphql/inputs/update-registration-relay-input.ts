import { ArgsType, Field, InputType } from "type-graphql";

@InputType("RelayInput", { isAbstract: true })
export class RelayInput {
    @Field(type => String)
    id!: string;

    @Field(type => String)
    address!: string;
}

@InputType("UpdateRegistrationRelayInput", { isAbstract: true })
export class UpdateRegistrationRelayInput {
    @Field(type => [String])
    toBeDeletedIds!: string[];

    @Field(type => [String])
    toBeAdded!: string[]

    @Field(type => [RelayInput])
    toBeUpdated!: RelayInput[];
}


@ArgsType()
export class UpdateRegistrationRelayInputArgs {
    @Field(type => String)
    registrationId!: string;

    @Field(type => UpdateRegistrationRelayInput)
    data!: UpdateRegistrationRelayInput;
}