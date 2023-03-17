import { Field, ObjectType } from "type-graphql";
import { UserOutput } from "./user-output";

@ObjectType("UserTokenOutput", { isAbstract: true, simpleResolvers: true })
export class UserTokenOutput {
    @Field((type) => String)
    id!: string;

    @Field((type) => String)
    userId!: string;

    @Field((type) => String)
    token!: string;

    @Field((type) => Date)
    validUntil!: Date;

    // Model Relations

    @Field((type) => [UserOutput])
    user?: UserOutput[];
}

