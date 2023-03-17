import { Authorized, Ctx, FieldResolver, Resolver, Root } from "type-graphql";
import { PrismaService } from "../../services/prisma-service";
import { RegistrationOutput } from "../outputs/registration-output";
import { RegistrationRelayOutput } from "../outputs/registration-relay-output";
import { UserOutput } from "../outputs/user-output";
import { GraphqlContext } from "../type-defs";

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

    @Authorized()
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

        return dbRegistrations.sortBy(x => x.address);
    }
}

