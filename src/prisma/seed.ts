import { PrismaClient } from "@prisma/client";
import { seedUsers } from "./seed/seed-users";
import { seedSystemBlockedIdentifier } from "./seed/seed-system-blocked-identifier";
import { seedSystemConfig } from "./seed/seed-system-config";

const prisma = new PrismaClient();

async function main() {
    await seedSystemConfig(prisma);
    await seedSystemBlockedIdentifier(prisma);
    await seedUsers(prisma);
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });

