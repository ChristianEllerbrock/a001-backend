import { PrismaClient } from "@prisma/client";

async function seedBot(
    prisma: PrismaClient,
    seedDate: Date,
    pubkey: string,
    identifier: string,
    systemDomainId: number
) {
    const botDbUser = await prisma.user.upsert({
        where: { pubkey: pubkey },
        update: {
            isSystemAgent: true,
        },
        create: {
            pubkey: pubkey,
            isSystemUser: true,
            isSystemAgent: true,
            createdAt: seedDate,
        },
    });

    await prisma.registration.upsert({
        where: { identifier_systemDomainId: { identifier, systemDomainId } },
        update: {},
        create: {
            userId: botDbUser.id,
            identifier,
            systemDomainId: 1,
            createdAt: seedDate,
            validUntil: seedDate,
            verifiedAt: seedDate,
        },
    });
}

const seed = async function (prisma: PrismaClient) {
    const seedDate = new Date();

    // #region bot users

    await seedBot(
        prisma,
        seedDate,
        "decfe634a6a6a6025fb59d4e139026381242b9ddad6b8d612d370c343942c005",
        "bot",
        1
    );
    await seedBot(
        prisma,
        seedDate,
        "c6d5eb25e5b352ba8e0e5bf5e70f79d6f18492d1fc294554a53996d4755221ef",
        "bot2",
        1
    );
    await seedBot(
        prisma,
        seedDate,
        "4b1ef958fe009df0c696b7443034c9d4f4e15b9948553e86693b43e689449961",
        "bot3",
        1
    );
    await seedBot(
        prisma,
        seedDate,
        "b96fc93681c73f2477a67bf462025d6b6f843db2aaea2b410f8e593316bfa92a",
        "bot4",
        1
    );
    await seedBot(
        prisma,
        seedDate,
        "50b61ee8f15860252a3835fd949a11b1ce5b01bb352d53b7e5437f130c178984",
        "bot5",
        1
    );
    await seedBot(
        prisma,
        seedDate,
        "f975acbafed19f190ec608c800dcd2acf4d2b376cdc144582cf51ca728a219c5",
        "bot6",
        1
    );
    await seedBot(
        prisma,
        seedDate,
        "d1f76005694e26ba955370ca74d86defe2862564c3eea79a7414d9a5fa30a9f4",
        "bot7",
        1
    );
    await seedBot(
        prisma,
        seedDate,
        "2b95e398f5c20509605639300c7a52252f77380e9d3268230bf0b49a277a0a87",
        "bot8",
        1
    );
    await seedBot(
        prisma,
        seedDate,
        "1e4ab9bf9395959dca9a52dfdfa83e38f74aa0153ece44163e3e4c71e9c81fcc",
        "bot9",
        1
    );
    await seedBot(
        prisma,
        seedDate,
        "8377ae5e4c818aa4e429a08f009d64295d43057bd90a5325137051602a432ef7",
        "bot10",
        1
    );

    // #endregion bot users

    // #region chris User

    const pubkeyChris =
        "090e4e48e07e331b7a9eb527532794969ab1086ddfa4d805fff88c6358e9d15d";

    const chrisDbUser = await prisma.user.upsert({
        where: { pubkey: pubkeyChris },
        update: {},
        create: {
            pubkey: pubkeyChris,
            isSystemUser: true,
            isSystemAgent: false,
            createdAt: seedDate,
        },
    });
    await prisma.registration.upsert({
        where: {
            identifier_systemDomainId: {
                identifier: "chris",
                systemDomainId: 1,
            },
        },
        update: {},
        create: {
            userId: chrisDbUser.id,
            identifier: "chris",
            systemDomainId: 1,
            createdAt: seedDate,
            validUntil: seedDate,
            verifiedAt: seedDate,
        },
    });
    // await prisma.registrationRelay.deleteMany({
    //     where: { registrationId: chrisDbRegistration.id },
    // });
    // await prisma.registrationRelay.createMany({
    //     data: [
    //         {
    //             registrationId: chrisDbRegistration.id,
    //             address: "wss://nostr-pub.wellorder.net",
    //         },
    //         {
    //             registrationId: chrisDbRegistration.id,
    //             address: "wss://relay.damus.io",
    //         },
    //         {
    //             registrationId: chrisDbRegistration.id,
    //             address: "wss://relay.snort.social",
    //         },
    //     ],
    // });

    // #endregion chris User
};

export { seed as seedUsers };

