import { PrismaClient } from "@prisma/client";

const seed = async function (prisma: PrismaClient) {
    let i = 1;
    await prisma.systemDomain.upsert({
        where: { id: i },
        update: {},
        create: {
            id: i,
            name: "nip05.social",
            order: 1,
        },
    });

    i = 2;
    await prisma.systemDomain.upsert({
        where: { id: i },
        update: {},
        create: {
            id: i,
            name: "nip05.cloud",
            order: 2,
        },
    });

    i = 3;
    await prisma.systemDomain.upsert({
        where: { id: i },
        update: {},
        create: {
            id: i,
            name: "nostrcom.com",
            order: 3,
        },
    });

    i = 4;
    await prisma.systemDomain.upsert({
        where: { id: i },
        update: {},
        create: {
            id: i,
            name: "unitednostr.com",
            order: 4,
        },
    });

    i = 5;
    await prisma.systemDomain.upsert({
        where: { id: i },
        update: {},
        create: {
            id: i,
            name: "protonostr.com",
            order: 5,
        },
    });

    i = 6;
    await prisma.systemDomain.upsert({
        where: { id: i },
        update: {},
        create: {
            id: i,
            name: "nostrid.info",
            order: 6,
        },
    });
};

export { seed as seedSystemDomain };

