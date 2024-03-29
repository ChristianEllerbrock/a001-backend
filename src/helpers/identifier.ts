import { IdentifierRegisterCheckOutput } from "../graphql/outputs/identifier-register-check-output";
import { PrismaService } from "../services/prisma-service";

export class HelperIdentifier {
    static async canIdentifierBeRegisteredAsync(
        identifier: string,
        systemDomainId: number,
        pubkey: string | undefined = undefined
    ): Promise<IdentifierRegisterCheckOutput> {
        const cleanIdentifier = identifier.trim().toLowerCase();

        // 0st check:
        // email identifier (starting with "email")
        if (cleanIdentifier.startsWith("email")) {
            return {
                name: cleanIdentifier,
                canBeRegistered: false,
                reason: "Name is reserved.",
            };
        }

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

        const dbSystemDomain =
            await PrismaService.instance.db.systemDomain.findUnique({
                where: { id: systemDomainId },
            });
        if (!dbSystemDomain) {
            return {
                name: cleanIdentifier,
                canBeRegistered: false,
                reason: "The provided domain does not exist.",
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
                    systemDomainId,
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
                where: {
                    identifier: cleanIdentifier,
                    systemDomainId,
                    verifiedAt: null,
                },
                include: { user: true },
            });
        if (
            dbPendingRegistration &&
            dbPendingRegistration.user.pubkey !== pubkey
        ) {
            return {
                name: cleanIdentifier,
                canBeRegistered: false,
                reason: "Name is pending registration by some user.",
            };
        }

        // Everything is ok. This identifier can be registered.
        return {
            name: cleanIdentifier,
            canBeRegistered: true,
        };
    }
}

