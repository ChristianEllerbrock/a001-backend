import { PrismaClient } from "@prisma/client";

const seed = async function (prisma: PrismaClient) {
    await prisma.systemConfig.deleteMany({});

    let i = 1;

    await prisma.systemConfig.upsert({
        where: { id: i },
        update: {},
        create: {
            id: i,
            name: "REGISTRATION_VALIDITY_IN_MINUTES",
            value: "20",
        },
    });

    i = 2;

    await prisma.systemConfig.upsert({
        where: { id: i },
        update: {},
        create: {
            id: i,
            name: "REGISTRATION_CODE_VALIDITY_IN_MINUTES",
            value: "10",
        },
    });

    i = 3;

    await prisma.systemConfig.upsert({
        where: { id: i },
        update: {
            value: "1440 ",
        },
        create: {
            id: i,
            name: "USER_TOKEN_VALIDITY_IN_MINUTES",
            value: "1440",
        },
    });

    i = 4;

    await prisma.systemConfig.upsert({
        where: { id: i },
        update: {},
        create: {
            id: i,
            name: "LOGIN_CODE_VALIDITY_IN_MINUTES",
            value: "10",
        },
    });

    i = 5;

    await prisma.systemConfig.upsert({
        where: { id: i },
        update: {},
        create: {
            id: i,
            name: "USER_FRAUD_OPTION_VALIDITY_IN_DAYS",
            value: "30",
        },
    });

    i = 6;

    await prisma.systemConfig.upsert({
        where: { id: i },
        update: {},
        create: {
            id: i,
            name: "LOGIN_NIP07_CODE_VALIDITY_IN_MINUTES",
            value: "2",
        },
    });

    i = 7;

    await prisma.systemConfig.upsert({
        where: { id: i },
        update: {},
        create: {
            id: i,
            name: "REGISTRATION_NIP07_CODE_VALIDITY_IN_MINUTES",
            value: "2",
        },
    });
};

export { seed as seedSystemConfig };

