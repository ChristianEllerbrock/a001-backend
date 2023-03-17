import { PrismaClient } from "@prisma/client";
import { UserEventTypeId } from "../interfaces";

const seed = async function (prisma: PrismaClient) {
    // await prisma.userEventType.upsert({
    //     where: { id: UserEventTypeId.userCreated },
    //     update: {},
    //     create: {
    //         id: UserEventTypeId.userCreated,
    //         name: "user created",
    //     },
    // });
    // await prisma.userEventType.upsert({
    //     where: { id: UserEventTypeId.userCreationVerificationTriggered },
    //     update: {},
    //     create: {
    //         id: UserEventTypeId.userCreationVerificationTriggered,
    //         name: "user creation verification triggered",
    //     },
    // });
    // await prisma.userEventType.upsert({
    //     where: { id: UserEventTypeId.userActivated },
    //     update: {},
    //     create: {
    //         id: UserEventTypeId.userActivated,
    //         name: "user activated",
    //     },
    // });
    // await prisma.userEventType.upsert({
    //     where: { id: UserEventTypeId.userLoginVerificationTriggered },
    //     update: {},
    //     create: {
    //         id: UserEventTypeId.userLoginVerificationTriggered,
    //         name: "user login verification triggered",
    //     },
    // });
    // await prisma.userEventType.upsert({
    //     where: { id: UserEventTypeId.userLoggedIn },
    //     update: {},
    //     create: {
    //         id: UserEventTypeId.userLoggedIn,
    //         name: "user logged in",
    //     },
    // });
    // await prisma.userEventType.upsert({
    //     where: { id: UserEventTypeId.userNipped },
    //     update: {},
    //     create: {
    //         id: UserEventTypeId.userNipped,
    //         name: "user nipped",
    //     },
    // });
};

export { seed as seedUserEventType };

