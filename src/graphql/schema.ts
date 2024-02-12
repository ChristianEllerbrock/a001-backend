import { BuildSchemaOptions } from "type-graphql";
import { AdminResolver } from "./resolvers/admin-resolver";
import { AuthResolver } from "./resolvers/auth-resolver";
import { LoginResolver } from "./resolvers/crud/login-resolver";
import { RegistrationRelayResolver } from "./resolvers/crud/registration-relay-resolver";
import { RegistrationResolver } from "./resolvers/crud/registration-resolver";
import { RegistrationResolverRelations } from "./resolvers/registration-resolver-relations";
import { UserResolver } from "./resolvers/crud/user-resolver";
import { UserRelationResolver } from "./resolvers/crud/user-relation-resolver";
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
import { PublicRelayResolver } from "./resolvers/crud/public-relay-resolver";
import { BotMetadataResolver } from "./resolvers/crud/bot-metadata-resolver";
import { BotMetadataRelationResolver } from "./resolvers/crud/bot-metadata-relation-resolver";
import { PromoCodeResolver } from "./resolvers/crud/promo-code-resolver";

export const schemaOptions: BuildSchemaOptions = {
    resolvers: [
        AdminResolver,
        AuthResolver,
        LoginResolver,
        UserRelationResolver,
        UserResolver,
        RegistrationResolver,
        RegistrationResolverRelations,
        RegistrationRelayResolver,
        StatisticsResolver,
        SystemResolver,
        DirectoryResolver,

        // Nostr
        NostrEventResolver,

        SubscriptionResolver,
        SubscriptionCalcResolver,
        UserSubscriptionResolver,
        UserSubscriptionResolverRelations,
        UserSubscriptionInvoiceResolverRelations,
        PublicRelayResolver,

        BotMetadataResolver,
        BotMetadataRelationResolver,

        PromoCodeResolver,
    ],
    authChecker: customAuthChecker,
    validate: { forbidUnknownValues: false },
};

