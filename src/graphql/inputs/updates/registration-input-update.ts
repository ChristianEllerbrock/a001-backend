import { ArgsType, Field, InputType } from "type-graphql";

@InputType()
export class RegistrationInputUpdate {
    @Field((type) => String, { nullable: true })
    lightningAddress?: string | null;

    @Field((type) => Boolean, { nullable: true })
    emailForwardingOn?: boolean | null;

    @Field((type) => Boolean)
    emailOut!: boolean;

    @Field((type) => String)
    emailOutSubject!: string;
}

@ArgsType()
export class RegistrationInputUpdateArgs {
    @Field((type) => String)
    registrationId!: string;

    @Field((type) => RegistrationInputUpdate)
    data!: RegistrationInputUpdate;
}

