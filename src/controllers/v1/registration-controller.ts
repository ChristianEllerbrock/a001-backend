/* eslint-disable @typescript-eslint/no-explicit-any */
import { Response, Request } from "express";
import { AuthenticatedRequest } from "../auth-middleware";
import { RegistrationDto, RegistrationPatchDto } from "@open-api";
import { Registration, RegistrationRelay, SystemDomain } from "@prisma/client";
import { HelperRegex } from "../../helpers/helper-regex";
import { Nip05NostrService } from "../../services/nip05-nostr/nip05-nostr-service";
import {
    generateMessageEmailInActivated,
    generateMessageEmailOutActivated,
} from "../../common/direct-messages/messages";

const getRegistrations = async function (
    req: Request,
    res: Response
    /*next: NextFunction*/
) {
    const extendedReq = req as AuthenticatedRequest;
    const sqlRegistrations =
        await extendedReq.context.sql.registration.findMany({
            where: {
                userId: extendedReq.user.id,
            },
            include: {
                systemDomain: true,
                registrationRelays: true,
            },
            orderBy: {
                systemDomain: { name: "asc" },
            },
        });

    const registrationDtos = sqlRegistrations.map((x) =>
        buildRegistrationDto(x)
    );
    res.status(200).json(registrationDtos);
};

const getRegistration = async function (
    req: Request,
    res: Response
    /*next: NextFunction*/
) {
    const id = req.params.id;
    const extendedReq = req as AuthenticatedRequest;

    const sqlRegistration =
        await extendedReq.context.sql.registration.findFirst({
            where: {
                id,
                userId: extendedReq.user.id,
            },
            include: {
                systemDomain: true,
                registrationRelays: true,
            },
        });

    if (!sqlRegistration) {
        res.status(404).json({
            message: `A registration with the id ${id} was not found.`,
        });
        return;
    }

    const registrationDto = buildRegistrationDto(sqlRegistration);

    res.status(200).json(registrationDto);
};

const patchRegistration = async function (
    req: Request,
    res: Response
    /*next: NextFunction*/
) {
    const id = req.params.id;
    const extendedReq = req as AuthenticatedRequest;

    const sqlRegistration =
        await extendedReq.context.sql.registration.findFirst({
            where: {
                id,
                userId: extendedReq.user.id,
            },
            include: {
                user: true,
                systemDomain: true,
                registrationRelays: true,
            },
        });

    if (!sqlRegistration) {
        res.status(404).json({
            message: `A registration with the id ${id} was not found.`,
        });
        return;
    }

    // All good. The user is allowed to patch this registration.
    // Create the update object.
    const patchDto = req.body as RegistrationPatchDto;
    const sqlUpdateObject: { [key: string]: any } = {};
    let emailOutWithThisRegistration = false;

    if (typeof patchDto.lightningAddress !== "undefined") {
        sqlUpdateObject["lightningAddress"] = patchDto.lightningAddress;
    }
    if (typeof patchDto.emailOut !== "undefined") {
        sqlUpdateObject["emailOut"] = patchDto.emailOut;
        if (patchDto.emailOut) {
            emailOutWithThisRegistration = true;
        }
    }
    if (typeof patchDto.emailOutSubject !== "undefined") {
        sqlUpdateObject["emailOutSubject"] = patchDto.emailOutSubject;
    }
    if (typeof patchDto.emailIn !== "undefined") {
        sqlUpdateObject["emailForwardingOn"] = patchDto.emailIn;
    }

    if (
        Object.keys(patchDto).length === 0 &&
        typeof patchDto.relays === "undefined"
    ) {
        // Nothing to do here.
        // Return the current registration.
        res.status(200).json(buildRegistrationDto(sqlRegistration));
        return;
    }

    // Check, if the provided lightning address is valid.
    if (
        patchDto.lightningAddress &&
        !HelperRegex.isValidLightningAddress(patchDto.lightningAddress)
    ) {
        res.status(400).json({
            message: "Invalid lightning address.",
        });
        return;
    }

    // Check, if the provided relays are valid.
    if (
        typeof patchDto.relays !== "undefined" &&
        patchDto.relays.some((x) => !HelperRegex.isValidRelay(x))
    ) {
        res.status(400).json({
            message: "One of the provided relay addresses is not valid.",
        });
        return;
    }

    // Check, if the user has activated EMAIL OUT but is only on the free plan.
    if (patchDto.emailOut && sqlRegistration.user.subscriptionId === 1) {
        res.status(400).json({
            message:
                "You are currently on the free BASIC plan where EMAIL OUT is not available. Subscribe to a paid plan first.",
        });
        return;
    }

    // Perform database updates within transaction.
    await extendedReq.context.sql.$transaction(async (db) => {
        if (Object.keys(sqlUpdateObject).length > 0) {
            await db.registration.update({
                where: {
                    id,
                },
                data: sqlUpdateObject,
            });

            if (emailOutWithThisRegistration) {
                await db.registration.updateMany({
                    where: {
                        id: {
                            not: id,
                        },
                        userId: extendedReq.user.id,
                        emailOut: true,
                    },
                    data: {
                        emailOut: false,
                    },
                });
            }
        }

        if (typeof patchDto.relays !== "undefined") {
            if (patchDto.relays.length === 0) {
                // Delete all existing relays.
                await db.registrationRelay.deleteMany({
                    where: {
                        registrationId: id,
                    },
                });
            } else {
                // Determine which relays to delete and which to create.
                const toBeDeletedIds = sqlRegistration.registrationRelays
                    .filter((x) => !patchDto.relays?.includes(x.address))
                    .map((x) => x.id);
                await db.registrationRelay.deleteMany({
                    where: {
                        id: {
                            in: toBeDeletedIds,
                        },
                    },
                });

                // Determine which relays need to be created.
                const toBeCreatedRelays = patchDto.relays.filter(
                    (x) =>
                        !sqlRegistration.registrationRelays
                            .map((x) => x.address)
                            .includes(x)
                );
                await db.registrationRelay.createMany({
                    data: toBeCreatedRelays.map((x) => {
                        return {
                            registrationId: id,
                            address: x,
                        };
                    }),
                });
            }
        }
    });

    // Trigger a DM if the user has activated EMAIL IN
    if (patchDto.emailIn) {
        Nip05NostrService.instance
            .getRelevantAccountRelays(sqlRegistration.user.pubkey)
            .then(async (relays) => {
                await Nip05NostrService.instance.sendDMFromBot(
                    sqlRegistration.user.pubkey,
                    relays,
                    generateMessageEmailInActivated(
                        sqlRegistration.identifier +
                            "@" +
                            sqlRegistration.systemDomain.name
                    )
                );
            });
    }

    // Trigger a DM if the user has activated EMAIL OUT
    if (patchDto.emailOut) {
        Nip05NostrService.instance
            .getRelevantAccountRelays(sqlRegistration.user.pubkey)
            .then(async (relays) => {
                await Nip05NostrService.instance.sendDMFromBot(
                    sqlRegistration.user.pubkey,
                    relays,
                    generateMessageEmailOutActivated(
                        sqlRegistration.identifier +
                            "@" +
                            sqlRegistration.systemDomain.name
                    )
                );
            });
    }

    const updatedSqlRegistration =
        await extendedReq.context.sql.registration.findFirst({
            where: {
                id,
                userId: extendedReq.user.id,
            },
            include: {
                systemDomain: true,
                registrationRelays: true,
            },
        });

    if (!updatedSqlRegistration) {
        res.status(500).json({
            message: `An error occurred while updating the registration. Please try again later`,
        });
        return;
    }

    res.status(200).json(buildRegistrationDto(updatedSqlRegistration));
};

const buildRegistrationDto = function (
    sqlRegistration: Registration & { systemDomain: SystemDomain } & {
        registrationRelays: RegistrationRelay[];
    }
): RegistrationDto {
    const registrationDto: RegistrationDto = {
        id: sqlRegistration.id,
        userId: sqlRegistration.userId,
        nostrAddress: `${sqlRegistration.identifier}@${sqlRegistration.systemDomain.name}`,
        lightningAddress: sqlRegistration.lightningAddress,
        emailIn: sqlRegistration.emailForwardingOn ?? false,
        emailOut: sqlRegistration.emailOut,
        emailOutSubject: sqlRegistration.emailOutSubject,
        relays: sqlRegistration.registrationRelays.map((x) => x.address).sort(),
    };
    return registrationDto;
};

export default { getRegistrations, getRegistration, patchRegistration };

