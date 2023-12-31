import { BuildSchemaOptions } from "type-graphql";
import { AdminResolver } from "./resolvers/admin-resolver";
import { AuthResolver } from "./resolvers/auth-resolver";
import { LoginResolver } from "./resolvers/crud/login-resolver";
import { RegistrationRelayResolver } from "./resolvers/crud/registration-relay-resolver";
import { RegistrationResolver } from "./resolvers/crud/registration-resolver";
import { RegistrationResolverRelations } from "./resolvers/registration-resolver-relations";
import { UserRelatedResolver } from "./resolvers/user-related-resolver";
import { UserResolverRelations } from "./resolvers/user-resolver-relations";
import { customAuthChecker } from "./type-defs";
import { SystemResolver } from "./resolvers/crud/system-resolver";
import { StatisticsResolver } from "./resolvers/crud/statistics-resolver";
import { JobSubResolver } from "./subscriptions/resolvers/job-sub-resolver";
import { NostrEventResolver } from "./resolvers/crud/nostr-event-resolver";
import { NostrEventSubscriptionResolver } from "./subscriptions/resolvers/nostr-event-subscription-resolver";
import { DirectoryResolver } from "./resolvers/crud/directory-resolver";
import { SubscriptionResolver } from "./resolvers/crud/subscription-resolver";
import { SubscriptionCalcResolver } from "./resolvers/crud/subscription-calc-resolver";
import { UserSubscriptionResolver } from "./resolvers/crud/user-subscription-resolver";
import { UserSubscriptionResolverRelations } from "./resolvers/crud/user-subscription-resolver-relations";
import { UserSubscriptionInvoiceResolverRelations } from "./resolvers/crud/user-subscription-invoice-resolver-relations";

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
        StatisticsResolver,
        SystemResolver,
        DirectoryResolver,

        // Subscription resolvers
        JobSubResolver,
        NostrEventSubscriptionResolver,

        // Nostr
        NostrEventResolver,

        SubscriptionResolver,
        SubscriptionCalcResolver,
        UserSubscriptionResolver,
        UserSubscriptionResolverRelations,
        UserSubscriptionInvoiceResolverRelations,
    ],
    authChecker: customAuthChecker,
    validate: { forbidUnknownValues: false },
};

