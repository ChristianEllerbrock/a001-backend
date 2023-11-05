import { PrismaClient } from "@prisma/client";

const seed = async function (prisma: PrismaClient) {
    await prisma.subscription.upsert({
        where: { id: 1 },
        update: {},
        create: {
            id: 1,
            name: "Free",
            satsPerMonth: 0,
            maxNoOfNostrAddresses: 1,
            maxNoOfInboundEmailsPerMOnth: 25,
            maxNoOfOutboundEmailsPerMonth: 0,
        },
    });

    await prisma.subscription.upsert({
        where: { id: 2 },
        update: {},
        create: {
            id: 2,
            name: "Basic",
            satsPerMonth: 6000,
            maxNoOfNostrAddresses: 5,
            maxNoOfInboundEmailsPerMOnth: -1, // unlimited
            maxNoOfOutboundEmailsPerMonth: 25,
        },
    });

    await prisma.subscription.upsert({
        where: { id: 3 },
        update: {},
        create: {
            id: 3,
            name: "Pro",
            satsPerMonth: 10000,
            maxNoOfNostrAddresses: -1,
            maxNoOfInboundEmailsPerMOnth: -1,
            maxNoOfOutboundEmailsPerMonth: -1,
        },
    });
};

export { seed as seedSubscription };

