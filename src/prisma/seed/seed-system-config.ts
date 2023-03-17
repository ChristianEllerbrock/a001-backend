import { PrismaClient } from "@prisma/client";

const seed = async function (prisma: PrismaClient) {
    await prisma.systemConfig.deleteMany({});

    let i = 1;
    await prisma.systemConfig.createMany({
        data: [
            { id: i++, name: "REGISTRATION_VALIDITY_IN_MINUTES", value: "20" },
            {
                id: i++,
                name: "REGISTRATION_CODE_VALIDITY_IN_MINUTES",
                value: "10",
            },
            {
                id: i++,
                name: "USER_TOKEN_VALIDITY_IN_MINUTES",
                value: "480",
            },
            {
                id: i++,
                name: "LOGIN_CODE_VALIDITY_IN_MINUTES",
                value: "10",
            },
        ],
    });
};

export { seed as seedSystemConfig };

