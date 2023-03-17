import { PrismaClient } from "@prisma/client";

const seed = async function (prisma: PrismaClient) {
    await prisma.systemBlockedIdentifier.deleteMany({});

    await prisma.systemBlockedIdentifier.createMany({
        data: [
            { name: "admin" },
            { name: "administrator" },
            { name: "bot" },
            { name: "chris" },
            { name: "help" },
            { name: "iijat" },
            { name: "info" },
            { name: "information" },
            { name: "nostr" },
            { name: "registration" },
            { name: "support" },
        ],
    });
};

export { seed as seedSystemBlockedIdentifier };

