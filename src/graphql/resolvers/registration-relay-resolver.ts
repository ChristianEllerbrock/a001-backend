import { Args, Authorized, Ctx, Mutation, Resolver } from "type-graphql";
import { UpdateRegistrationRelayInputArgs } from "../inputs/update-registration-relay-input";
import { RegistrationOutput } from "../outputs/registration-output";
import { GraphqlContext } from "../type-defs";

@Resolver()
export class RegistrationRelayResolver {
    @Authorized()
    @Mutation(returns => RegistrationOutput)
    async updateRegistrationRelays(@Ctx() context: GraphqlContext, @Args() args: UpdateRegistrationRelayInputArgs): Promise<RegistrationOutput> {
        const dbRegistration = await context.db.registration.findFirst({
            where: { id: args.registrationId, userId: context.user?.userId },
            include: { registrationRelays: true }
        });

        if (!dbRegistration) {
            throw new Error("Could not find your registration.");
        }

        // First, handle "TO BE DELETED" records.
        if (args.data.toBeDeletedIds.length > 0) {
            await context.db.registrationRelay.deleteMany({
                where: { id: { in: args.data.toBeDeletedIds } }
            });
        }

        // Second, handle "TO BE UPDATED" records
        for (let toBeUpdated of args.data.toBeUpdated) {
            await context.db.registrationRelay.update({
                where: { id: toBeUpdated.id },
                data: {
                    address: toBeUpdated.address.toLowerCase()
                }
            });
        }

        // Third, handle "TO BE ADDED" records
        for (let toBeAdded of args.data.toBeAdded) {
            await context.db.registrationRelay.create({
                data: {
                    registrationId: dbRegistration.id,
                    address: toBeAdded.toLowerCase()
                }
            });
        }

        return dbRegistration;
    }
}