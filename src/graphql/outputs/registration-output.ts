import { Field, Int, ObjectType } from "type-graphql";
import { RegistrationCodeOutput } from "./registration-code-output";
import { RegistrationRelayOutput } from "./registration-relay-output";
import { UserOutput } from "./user-output";
import { SystemDomainOutput } from "./system-domain";

@ObjectType("RegistrationOutput", {
    isAbstract: true,
    simpleResolvers: true,
})
export class RegistrationOutput {
    @Field((type) => String)
    id!: string;

    @Field((type) => String)
    userId!: string;

    @Field((type) => String)
    identifier!: string;

    @Field((type) => Date)
    createdAt!: Date;

    @Field((type) => Date)
    validUntil!: Date;

    @Field((type) => Date, { nullable: true })
    verifiedAt!: Date | null;

    @Field((type) => Int)
    nipped!: number;

    @Field((type) => Int)
    systemDomainId!: number;

    @Field((type) => Date, { nullable: true })
    lastLookupDate!: Date | null;

    @Field((type) => String, { nullable: true })
    lightningAddress!: string | null;

    // Model Relations

    @Field((type) => UserOutput)
    user?: UserOutput;

    @Field((type) => SystemDomainOutput)
    systemDomain?: SystemDomainOutput;

    @Field((type) => [RegistrationCodeOutput])
    registrationsRelays?: RegistrationRelayOutput[];
}

