import { PrismaClient } from "@prisma/client";

const seed = async function (prisma: PrismaClient) {
    let i = 1;
    await prisma.systemRelay.upsert({
        where: { id: i },
        update: {},
        create: {
            id: i,
            url: "wss://relay.damus.io",
            isActive: true,
        },
    });

    i = 2;
    await prisma.systemRelay.upsert({
        where: { id: i },
        update: {},
        create: {
            id: i,
            url: "wss://nos.lol",
            isActive: true,
        },
    });

    i = 3;
    await prisma.systemRelay.upsert({
        where: { id: i },
        update: {},
        create: {
            id: i,
            url: "wss://relay.snort.social",
            isActive: true,
        },
    });

    i = 4;
    await prisma.systemRelay.upsert({
        where: { id: i },
        update: {},
        create: {
            id: i,
            url: "wss://nostr1.current.fyi",
            isActive: true,
        },
    });

    i = 5;
    await prisma.systemRelay.upsert({
        where: { id: i },
        update: {},
        create: {
            id: i,
            url: "wss://nostr-pub.wellorder.net",
            isActive: true,
        },
    });

    i = 6;
    await prisma.systemRelay.upsert({
        where: { id: i },
        update: {},
        create: {
            id: i,
            url: "wss://relay.nostr.bg",
            isActive: true,
        },
    });

    i = 7;
    await prisma.systemRelay.upsert({
        where: { id: i },
        update: {},
        create: {
            id: i,
            url: "wss://no.str.cr",
            isActive: true,
        },
    });

    i = 8;
    await prisma.systemRelay.upsert({
        where: { id: i },
        update: {},
        create: {
            id: i,
            url: "wss://nostr.mom",
            isActive: true,
        },
    });

    i = 9;
    await prisma.systemRelay.upsert({
        where: { id: i },
        update: {},
        create: {
            id: i,
            url: "wss://relay.plebstr.com",
            isActive: true,
        },
    });

    i = 10;
    await prisma.systemRelay.upsert({
        where: { id: i },
        update: {},
        create: {
            id: i,
            url: "wss://offchain.pub",
            isActive: true,
        },
    });

    i = 11;
    await prisma.systemRelay.upsert({
        where: { id: i },
        update: {},
        create: {
            id: i,
            url: "wss://nostr.bitcoiner.social",
            isActive: true,
        },
    });

    i = 12;
    await prisma.systemRelay.upsert({
        where: { id: i },
        update: {},
        create: {
            id: i,
            url: "wss://spore.ws",
            isActive: true,
        },
    });

    i = 13;
    await prisma.systemRelay.upsert({
        where: { id: i },
        update: {},
        create: {
            id: i,
            url: "wss://nostr21.com",
            isActive: true,
        },
    });
};

export { seed as seedSystemRelay };

