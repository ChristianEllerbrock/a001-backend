import { ArgsType, Field, InputType } from "type-graphql";

@InputType()
export class RegistrationInputUpdate {
    @Field((type) => String, { nullable: true })
    lightningAddress?: string | null;
}

@ArgsType()
export class RegistrationInputUpdateArgs {
    @Field((type) => String)
    registrationId!: string;

    @Field((type) => RegistrationInputUpdate)
    data!: RegistrationInputUpdate;
}

