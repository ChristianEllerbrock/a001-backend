import { IdentifierRegisterCheckOutput } from "../graphql/outputs/identifier-register-check-output";
import { PrismaService } from "../services/prisma-service";

export class HelperIdentifier {
    static async canNostrAddressBeRegistered(
        nostrAddress: string,
        requesterPubkey: string
    ): Promise<{
        nostrAddress: string;
        identifier: string;
        systemDomainId: number;
        canBeRegistered: boolean;
        reason?: string;
    }> {
        const [identifier, domain] = nostrAddress
            .trim()
            .toLowerCase()
            .split("@");

        const cleanedNostrAddress = identifier + "@" + domain;

        // 0st check:
        // email identifier (starting with "email")
        if (identifier.startsWith("email")) {
            return {
                nostrAddress: cleanedNostrAddress,
                identifier,
                systemDomainId: -1,
                canBeRegistered: false,
                reason: "Name is reserved.",
            };
        }

        // 1st check:
        // more than 2 characters
        if (identifier.length <= 2) {
            return {
                nostrAddress: cleanedNostrAddress,
                identifier,
                systemDomainId: -1,
                canBeRegistered: false,
                reason: "Name too short.",
            };
        }

        // 2nd check:
        // allowed characters: a-z0-9-_.
        if (!/^[a-z0-9-_.]+$/.test(identifier)) {
            return {
                nostrAddress: cleanedNostrAddress,
                identifier,
                systemDomainId: -1,
                canBeRegistered: false,
                reason: "Name contains illegal characters.",
            };
        }

        const sqlSystemDomain =
            await PrismaService.instance.db.systemDomain.findFirst({
                where: { name: domain },
            });
        if (!sqlSystemDomain) {
            return {
                nostrAddress: cleanedNostrAddress,
                identifier,
                systemDomainId: -1,
                canBeRegistered: false,
                reason: "The provided domain does not exist.",
            };
        }

        // 3nd check:
        // On blocked list
        const sqlBlockedIdentifier =
            await PrismaService.instance.db.systemBlockedIdentifier.findFirst({
                where: { name: identifier },
            });
        if (sqlBlockedIdentifier) {
            return {
                nostrAddress: cleanedNostrAddress,
                identifier,
                systemDomainId: sqlSystemDomain.id,
                canBeRegistered: false,
                reason: "Name is blocked or reserved.",
            };
        }

        // 4th check:
        // already registered
        const sqlRegistration =
            await PrismaService.instance.db.registration.findFirst({
                where: {
                    identifier: identifier,
                    systemDomainId: sqlSystemDomain.id,
                    verifiedAt: { not: null },
                },
            });
        if (sqlRegistration) {
            return {
                nostrAddress: cleanedNostrAddress,
                identifier,
                systemDomainId: sqlSystemDomain.id,
                canBeRegistered: false,
                reason: "Name already registered.",
            };
        }

        // 5th check:
        // pending registration
        const sqlPendingRegistration =
            await PrismaService.instance.db.registration.findFirst({
                where: {
                    identifier: identifier,
                    systemDomainId: sqlSystemDomain.id,
                    verifiedAt: null,
                },
                include: { user: true },
            });
        if (
            sqlPendingRegistration &&
            sqlPendingRegistration.user.pubkey !== requesterPubkey
        ) {
            return {
                nostrAddress: cleanedNostrAddress,
                identifier,
                systemDomainId: sqlSystemDomain.id,
                canBeRegistered: false,
                reason: "Name is pending registration by some user.",
            };
        }

        // Everything is ok. This identifier can be registered.
        return {
            nostrAddress: cleanedNostrAddress,
            identifier,
            systemDomainId: sqlSystemDomain.id,
            canBeRegistered: true,
        };
    }

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

