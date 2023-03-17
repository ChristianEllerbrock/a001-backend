import { IdentifierRegisterCheckOutput } from "../graphql/outputs/identifier-register-check-output";
import { PrismaService } from "../services/prisma-service";

export class HelperIdentifier {
    static async canIdentifierBeRegisteredAsync(
        identifier: string
    ): Promise<IdentifierRegisterCheckOutput> {
        const cleanIdentifier = identifier.trim().toLowerCase();

        // 1st check:
        // more than 2 characters
        if (cleanIdentifier.length <= 2) {
            return {
                name: cleanIdentifier,
                canBeRegistered: false,
                reason: "Name too short.",
            };
        }

        // 2nd check:
        // allowed characters: a-z0-9-_.
        if (!/^[a-z0-9-_.]+$/.test(cleanIdentifier)) {
            return {
                name: cleanIdentifier,
                canBeRegistered: false,
                reason: "Name contains illegal characters.",
            };
        }

        // 3nd check:
        // On blocked list
        const dbBlockedIdentifier =
            await PrismaService.instance.db.systemBlockedIdentifier.findFirst({
                where: { name: cleanIdentifier },
            });
        if (dbBlockedIdentifier) {
            return {
                name: cleanIdentifier,
                canBeRegistered: false,
                reason: "Name is blocked or reserved.",
            };
        }

        // 4th check:
        // already registered
        const dbRegistration =
            await PrismaService.instance.db.registration.findFirst({
                where: {
                    identifier: cleanIdentifier,
                    verifiedAt: { not: null },
                },
            });
        if (dbRegistration) {
            return {
                name: cleanIdentifier,
                canBeRegistered: false,
                reason: "Name already registered.",
            };
        }

        // 5th check:
        // pending registration
        const dbPendingRegistration =
            await PrismaService.instance.db.registration.findFirst({
                where: { identifier: cleanIdentifier, verifiedAt: null },
            });
        if (dbPendingRegistration) {
            return {
                name: cleanIdentifier,
                canBeRegistered: false,
                reason: "Name is pending registration.",
            };
        }

        // Everything is ok. This identifier can be registered.
        return {
            name: cleanIdentifier,
            canBeRegistered: true,
        };
    }
}

