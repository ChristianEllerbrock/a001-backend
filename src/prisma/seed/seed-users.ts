import { PrismaClient } from "@prisma/client";
import { Nostr } from "../../nostr/nostr";
import { EnvService } from "../../services/env-service";

const seed = async function (prisma: PrismaClient) {
    const seedDate = new Date();

    // #region bot User

    const pubkey = Nostr.getPubKeyHexObjectFromPrivKey(
        EnvService.instance.env.BOT_PRIVKEY
    ).hex;

    const botDbUser = await prisma.user.upsert({
        where: { pubkey: pubkey },
        update: {},
        create: {
            pubkey: pubkey,
            createdAt: seedDate,
        },
    });

    const botDbRegistration = await prisma.registration.upsert({
        where: { identifier: "bot" },
        update: {},
        create: {
            userId: botDbUser.id,
            identifier: "bot",
            createdAt: seedDate,
            validUntil: seedDate,
            verifiedAt: seedDate,
        },
    });

    await prisma.registrationRelay.deleteMany({
        where: { registrationId: botDbRegistration.id },
    });
    await prisma.registrationRelay.create({
        data: {
            registrationId: botDbRegistration.id,
            address: "wss://nostr-pub.wellorder.net",
        },
    });

    // #endregion bot User

    // #region chris User
    const pubkeyChris =
        "090e4e48e07e331b7a9eb527532794969ab1086ddfa4d805fff88c6358e9d15d";

    const chrisDbUser = await prisma.user.upsert({
        where: { pubkey: pubkeyChris },
        update: {},
        create: {
            pubkey: pubkeyChris,
            createdAt: seedDate,
        },
    });
    const chrisDbRegistration = await prisma.registration.upsert({
        where: { identifier: "chris" },
        update: {},
        create: {
            userId: chrisDbUser.id,
            identifier: "chris",
            createdAt: seedDate,
            validUntil: seedDate,
            verifiedAt: seedDate,
        },
    });
    await prisma.registrationRelay.deleteMany({
        where: { registrationId: chrisDbRegistration.id },
    });
    await prisma.registrationRelay.createMany({
        data: [
            {
                registrationId: chrisDbRegistration.id,
                address: "wss://nostr-pub.wellorder.net",
            },
            {
                registrationId: chrisDbRegistration.id,
                address: "wss://relay.damus.io",
            },
            {
                registrationId: chrisDbRegistration.id,
                address: "wss://relay.snort.social",
            },
        ],
    });

    // #endregion chris User
};

export { seed as seedUsers };

