import { PrismaService } from "../services/prisma-service";
import { Nip05 } from "./type-defs";

/**
 * Performs a lookup in the database and returns a [userId, Nip05] tuple if available.
 * If no database record was found, an exception is thrown.
 */
export async function buildNip05FromDatabaseAsync(
    identifier: string
): Promise<[string, Nip05]> {
    const dbRegistration =
        await PrismaService.instance.db.registration.findFirst({
            where: {
                identifier,
                verifiedAt: { not: null },
            },
            include: {
                user: true,
                registrationRelays: true,
            },
        });

    if (!dbRegistration) {
        throw new Error(`No record found with the name '${identifier}'.`);
    }

    const data: Nip05 = {
        names: {},
    };
    data.names[identifier] = dbRegistration.user.pubkey;

    if (dbRegistration.registrationRelays.length > 0) {
        data.relays = {};
        data.relays[dbRegistration.user.pubkey] =
            dbRegistration.registrationRelays.map((x) => x.address);
    }

    return [dbRegistration.id, data];
}

