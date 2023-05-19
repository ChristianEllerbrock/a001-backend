import { PrismaClient } from "@prisma/client";

const seed = async function (prisma: PrismaClient) {
    let i = 1;
    await prisma.jobState.upsert({
        where: { id: i },
        update: {},
        create: {
            id: i,
            name: "created",
        },
    });

    i = 2;
    await prisma.jobState.upsert({
        where: { id: i },
        update: {},
        create: {
            id: i,
            name: "running",
        },
    });

    i = 3;
    await prisma.jobState.upsert({
        where: { id: i },
        update: {},
        create: {
            id: i,
            name: "finished",
        },
    });
};

export { seed as seedJobState };

