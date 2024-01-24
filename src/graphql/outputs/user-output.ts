import { Field, Int, ObjectType } from "type-graphql";
import { RegistrationOutput } from "./registration-output";
import { SubscriptionOutput } from "./subscriptionOutput";

@ObjectType()
export class UserOutput {
    @Field((type) => String)
    id!: string;

    @Field((type) => String)
    pubkey!: string;

    @Field((type) => Date)
    createdAt!: Date;

    @Field((type) => Boolean, { nullable: true })
    isSystemUser?: boolean | null;

    @Field((type) => Date, { nullable: true })
    subscriptionEnd?: Date | null;

    @Field((type) => Int)
    subscriptionId!: number;

    @Field((type) => String, { nullable: true })
    lastSeenNip05!: string | null;

    @Field((type) => Date, { nullable: true })
    lastSeenNip05At!: Date | null;

    @Field((type) => String, { nullable: true })
    lastSeenNip05Event!: string | null;

    // Model Relations

    @Field((type) => [RegistrationOutput], { nullable: true })
    registrations?: RegistrationOutput[] | null;

    @Field((type) => String)
    npub?: string;

    subscription?: SubscriptionOutput;
}

