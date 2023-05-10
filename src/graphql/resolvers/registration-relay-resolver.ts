import { Args, Authorized, Ctx, Mutation, Resolver } from "type-graphql";
import { UpdateRegistrationRelayInputArgs } from "../inputs/update-registration-relay-input";
import { RegistrationOutput } from "../outputs/registration-output";
import { GraphqlContext } from "../type-defs";
import { HelperRegex } from "../../helpers/helper-regex";
import { RegistrationRelayOutput } from "../outputs/registration-relay-output";

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
                    registration: true,
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

        return updatedDbRegistrationRelay;
    }
}

