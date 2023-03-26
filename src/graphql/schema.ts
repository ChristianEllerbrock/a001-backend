import { BuildSchemaOptions } from "type-graphql";
import { AdminResolver } from "./resolvers/admin-resolver";
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
        AdminResolver,
        AuthResolver,
        LoginResolver,
        UserResolverRelations,
        UserRelatedResolver,
        RegistrationResolver,
        RegistrationResolverRelations,
        RegistrationRelayResolver,
    ],
    authChecker: customAuthChecker,
    validate: { forbidUnknownValues: false }
};

