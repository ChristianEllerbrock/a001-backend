import { PrismaClient } from "@prisma/client";
import { seedUsers } from "./seed/seed-users";
import { seedSystemBlockedIdentifier } from "./seed/seed-system-blocked-identifier";
import { seedSystemConfig } from "./seed/seed-system-config";
import { seedSystemDomain } from "./seed/seed-system-domain";
import { seedJobState } from "./seed/seed-job-state";
import { seedJobType } from "./seed/seed-job-type";
import { seedSystemRelay } from "./seed/seed-system-relay";

const prisma = new PrismaClient();

async function main() {
    await seedJobState(prisma);
    await seedJobType(prisma);
    await seedSystemConfig(prisma);
    await seedSystemDomain(prisma);
    await seedSystemRelay(prisma);
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

