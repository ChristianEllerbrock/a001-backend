import { PrismaClient } from "@prisma/client";

const seed = async function (prisma: PrismaClient) {
    await prisma.subscription.upsert({
        where: { id: 1 },
        update: {
            name: "BASIC",
            maxNoOfInboundEmailsPer30Days: 15,
        },
        create: {
            id: 1,
            name: "Free",
            satsPer30Days: 0,
            maxNoOfNostrAddresses: 1,
            maxNoOfInboundEmailsPer30Days: 25,
            maxNoOfOutboundEmailsPer30Days: 0,
        },
    });

    await prisma.subscription.upsert({
        where: { id: 2 },
        update: {
            name: "PRO",
        },
        create: {
            id: 2,
            name: "Basic",
            satsPer30Days: 6000,
            maxNoOfNostrAddresses: 5,
            maxNoOfInboundEmailsPer30Days: -1, // unlimited
            maxNoOfOutboundEmailsPer30Days: 25,
        },
    });

    await prisma.subscription.upsert({
        where: { id: 3 },
        update: {
            name: "ADVANCED",
        },
        create: {
            id: 3,
            name: "Pro",
            satsPer30Days: 10000,
            maxNoOfNostrAddresses: -1,
            maxNoOfInboundEmailsPer30Days: -1,
            maxNoOfOutboundEmailsPer30Days: -1,
        },
    });
};

export { seed as seedSubscription };

