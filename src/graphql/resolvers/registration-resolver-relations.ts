import { Authorized, Ctx, FieldResolver, Resolver, Root } from "type-graphql";
import { PrismaService } from "../../services/prisma-service";
import { RegistrationOutput } from "../outputs/registration-output";
import { RegistrationRelayOutput } from "../outputs/registration-relay-output";
import { UserOutput } from "../outputs/user-output";
import { GraphqlContext } from "../type-defs";
import { SystemDomainOutput } from "../outputs/system-domain";

@Resolver((of) => RegistrationOutput)
export class RegistrationResolverRelations {
    @Authorized()
    @FieldResolver((returns) => UserOutput, { nullable: true })
    async user(
        @Root() registration: RegistrationOutput
    ): Promise<UserOutput | null> {
        const dbUser = await PrismaService.instance.db.registration
            .findUnique({
                where: { id: registration.id },
            })
            .user({});

        return dbUser;
    }

    //@Authorized()
    @FieldResolver((returns) => [RegistrationRelayOutput], { nullable: true })
    async registrationRelays(
        @Root() registration: RegistrationOutput,
        @Ctx() context: GraphqlContext
    ): Promise<RegistrationRelayOutput[] | null> {
        const dbRegistrations = await context.db.registration
            .findUnique({
                where: { id: registration.id },
            })
            .registrationRelays({});

        if (dbRegistrations === null) {
            return [];
        }

        return dbRegistrations.sortBy((x) => x.address);
    }

    //@Authorized()
    @FieldResolver((returns) => SystemDomainOutput)
    async systemDomain(
        @Root() registration: RegistrationOutput,
        @Ctx() context: GraphqlContext
    ): Promise<SystemDomainOutput> {
        const dbSystemDomain = await context.db.registration
            .findUnique({
                where: { id: registration.id },
            })
            .systemDomain({});

        if (!dbSystemDomain) {
            throw new Error("Could not find domain info for registration.");
        }

        return dbSystemDomain;
    }
}

