import { Arg, Args, Authorized, Ctx, Mutation, Resolver } from "type-graphql";
import { UpdateRegistrationRelayInputArgs } from "../inputs/update-registration-relay-input";
import { RegistrationOutput } from "../outputs/registration-output";
import { GraphqlContext } from "../type-defs";
import { HelperRegex } from "../../helpers/helper-regex";
import { RegistrationRelayOutput } from "../outputs/registration-relay-output";
import { Nip05CacheService } from "../../services/nip05-cache-service";

@Resolver()
export class RegistrationRelayResolver {
    @Authorized()
    @Mutation((returns) => RegistrationRelayOutput)
    async updateRegistrationRelay(
        @Ctx() context: GraphqlContext,
        @Args() args: UpdateRegistrationRelayInputArgs
    ): Promise<RegistrationRelayOutput> {
        const dbRegistrationRelay =
            await context.db.registrationRelay.findUnique({
                where: { id: args.registrationRelayId },
                include: {
                    registration: {
                        include: { systemDomain: true },
                    },
                },
            });

        if (
            !dbRegistrationRelay ||
            context.user?.userId !== dbRegistrationRelay.registration.userId
        ) {
            throw new Error(
                "Could not find the requested relay or unauthorized."
            );
        }

        const cleanRelayAddress = args.address.trim().toLowerCase();

        if (!HelperRegex.isValidRelay(cleanRelayAddress)) {
            throw new Error("Invalid relay address provided.");
        }

        const updatedDbRegistrationRelay =
            await context.db.registrationRelay.update({
                where: { id: dbRegistrationRelay.id },
                data: {
                    address: cleanRelayAddress,
                },
            });

        // Invalidate NIP-05 cache for this registration
        Nip05CacheService.instance.invalidate(
            dbRegistrationRelay.registration.identifier +
                "@" +
                dbRegistrationRelay.registration.systemDomain.name
        );

        return updatedDbRegistrationRelay;
    }

    @Authorized()
    @Mutation((returns) => Boolean)
    async deleteRegistrationRelay(
        @Ctx() context: GraphqlContext,
        @Arg("registrationRelayId") registrationRelayId: string
    ): Promise<boolean> {
        const dbRegistrationRelay =
            await context.db.registrationRelay.findUnique({
                where: { id: registrationRelayId },
                include: {
                    registration: {
                        include: { systemDomain: true },
                    },
                },
            });

        if (
            !dbRegistrationRelay ||
            context.user?.userId !== dbRegistrationRelay.registration.userId
        ) {
            throw new Error(
                "Could not find the requested relay or unauthorized."
            );
        }

        await context.db.registrationRelay.delete({
            where: { id: registrationRelayId },
        });

        // Invalidate NIP-05 cache for this registration
        Nip05CacheService.instance.invalidate(
            dbRegistrationRelay.registration.identifier +
                "@" +
                dbRegistrationRelay.registration.systemDomain.name
        );

        return true;
    }

    @Authorized()
    @Mutation((returns) => RegistrationRelayOutput)
    async addRegistrationRelay(
        @Ctx() context: GraphqlContext,
        @Arg("registrationId") registrationId: string,
        @Arg("relay", (type) => String, { nullable: true }) relay: string | null
    ): Promise<RegistrationRelayOutput> {
        const dbRegistration = await context.db.registration.findUnique({
            where: { id: registrationId },
            include: { systemDomain: true },
        });

        if (!dbRegistration || dbRegistration.userId !== context.user?.userId) {
            throw new Error(
                "Could not find the requested registration or unauthorized."
            );
        }

        const cleanedRelay = relay
            ? relay.trim().toLowerCase()
            : "wss://changeme.com";

        const dbRegistrationRelay = await context.db.registrationRelay.create({
            data: {
                registrationId: dbRegistration.id,
                address: cleanedRelay,
            },
        });

        // Invalidate NIP-05 cache for this registration
        Nip05CacheService.instance.invalidate(
            dbRegistration.identifier + "@" + dbRegistration.systemDomain.name
        );

        return dbRegistrationRelay;
    }
}

