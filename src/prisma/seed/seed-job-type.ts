import { PrismaClient } from "@prisma/client";

const seed = async function (prisma: PrismaClient) {
    let i = 1;
    await prisma.jobType.upsert({
        where: { id: i },
        update: {},
        create: {
            id: i,
            name: "nostr direct message",
        },
    });
};

export { seed as seedJobType };

