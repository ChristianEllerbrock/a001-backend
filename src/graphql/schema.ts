import { BuildSchemaOptions } from "type-graphql";
import { AuthResolver } from "./resolvers/auth-resolver";
import { LoginResolver } from "./resolvers/login-resolver";
import { RegistrationRelayResolver } from "./resolvers/registration-relay-resolver";
import { RegistrationResolver } from "./resolvers/registration-resolver";
import { RegistrationResolverRelations } from "./resolvers/registration-resolver-relations";
import { UserRelatedResolver } from "./resolvers/user-related-resolver";
import { UserResolverRelations } from "./resolvers/user-resolver-relations";
import { customAuthChecker } from "./type-defs";

export const schemaOptions: BuildSchemaOptions = {
    resolvers: [
        UserResolverRelations,
        AuthResolver,
        UserRelatedResolver,
        RegistrationResolver,
        RegistrationResolverRelations,
        RegistrationRelayResolver,
        LoginResolver,
    ],
    authChecker: customAuthChecker,
    validate: { forbidUnknownValues: false }
};

