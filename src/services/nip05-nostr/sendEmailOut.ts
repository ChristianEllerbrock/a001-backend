import { Event } from "nostr-tools";
import { Nip05NostrService } from "./nip05-nostr-service";
import { log } from "./common";
import { AzureCommunicationService } from "../azure-communication-service";
import { EmailClient } from "@azure/communication-email";
import { EnvService } from "../env-service";

export type SendEmailOutResponse = {
    emailNostrId: number | undefined;
    systemUserId: number | undefined;
    to: string;
    from: string;
    subject: string;
};

export const sendEmailOut = async function (
    this: Nip05NostrService,
    event: Event,
    senderEmail: string,
    senderMessage: string,
    senderFallbackSubject: string,
    dbEmailNostr: DbEmailNostr | null,
    dbSystemUser: DbSystemUser | null
): Promise<SendEmailOutResponse | undefined> {
    if (dbEmailNostr) {
        return await sendEmailOutViaEmailMirror.call(
            this,
            event,
            senderEmail,
            senderMessage,
            senderFallbackSubject,
            dbEmailNostr
        );
    }

    if (dbSystemUser) {
        return await sendEmailOutViaEmailHub.call(
            this,
            event,
            senderEmail,
            senderMessage,
            senderFallbackSubject,
            dbSystemUser
        );
    }
};

const sendEmailOutViaEmailMirror = async function (
    this: Nip05NostrService,
    event: Event,
    senderEmail: string,
    senderMessage: string,
    senderFallbackSubject: string,
    dbEmailNostr: DbEmailNostr
): Promise<SendEmailOutResponse | undefined> {
    // Check if the intended email was already sent.
    if (
        dbEmailNostr.emailNostrDms.find(
            (x) => x.eventId === event.id && typeof x.sent !== "undefined"
        )
    ) {
        log(event, "DM was already sent. Do nothing");
        return;
    }

    const deconstructedMessage = deconstructMessage(senderMessage);

    // Make sure that the email exists in Azure as sender.
    await AzureCommunicationService.instance.addEmail(senderEmail);

    // Determine the right connectionString;

    // Send Email.
    const client = new EmailClient(determineConnectionString(senderEmail));
    const emailMessage = {
        senderAddress: senderEmail,
        content: {
            subject: deconstructedMessage.subject ?? senderFallbackSubject,
            plainText: deconstructedMessage.message ?? "na",
        },
        recipients: {
            to: [{ address: dbEmailNostr.email.address }],
        },
    };
    // https://learn.microsoft.com/en-us/azure/communication-services/quickstarts/email/add-multiple-senders-mgmt-sdks?pivots=programming-language-javascript
    const poller = await client.beginSend(emailMessage);
    await poller.pollUntilDone();
    return {
        emailNostrId: dbEmailNostr.id,
        systemUserId: undefined,
        from: senderEmail,
        to: dbEmailNostr.email.address,
        subject: deconstructedMessage.subject ?? senderFallbackSubject,
    };
};

const sendEmailOutViaEmailHub = async function (
    this: Nip05NostrService,
    event: Event,
    senderEmail: string,
    senderMessage: string,
    senderFallbackSubject: string,
    dbSystemUser: DbSystemUser
): Promise<SendEmailOutResponse | undefined> {
    const deconstructedMessage = deconstructMessage(senderMessage);

    if (!deconstructedMessage.to) {
        log(event, "No email 'to' could be extracted from the message.");
        return;
    }

    //const dbSystemUser =

    // Check if the intended email was already sent.
    if (dbSystemUser?.systemUserDms.find((x) => x.eventId === event.id)) {
        log(event, "DM was already sent. Do nothing");
        return;
    }

    // Make sure that the email exists in Azure as sender.
    await AzureCommunicationService.instance.addEmail(senderEmail);

    // Send Email.
    const client = new EmailClient(determineConnectionString(senderEmail));
    const emailMessage = {
        senderAddress: senderEmail,
        content: {
            subject: deconstructedMessage.subject ?? senderFallbackSubject,
            plainText: deconstructedMessage.message ?? "na",
        },
        recipients: {
            to: [{ address: deconstructedMessage.to }],
        },
    };
    // https://learn.microsoft.com/en-us/azure/communication-services/quickstarts/email/add-multiple-senders-mgmt-sdks?pivots=programming-language-javascript
    const poller = await client.beginSend(emailMessage);
    await poller.pollUntilDone();
    return {
        emailNostrId: undefined,
        systemUserId: dbSystemUser.id,
        from: senderEmail,
        to: deconstructedMessage.to,
        subject: deconstructedMessage.subject ?? senderFallbackSubject,
    };
};

const deconstructMessage = function (message: string) {
    const returnValue: {
        to: string | undefined;
        subject: string | undefined;
        message: string | undefined;
    } = {
        to: undefined,
        subject: undefined,
        message: undefined,
    };

    const subjectCommandPattern = /-s "[^"]+"/i;
    const toCommandPattern = /-to "[^"]+"/i;

    let remainingMessage = message;

    const rSubjectCommand = new RegExp(subjectCommandPattern);
    const rSubjectCommandResult = rSubjectCommand.exec(message);
    if (rSubjectCommandResult != null) {
        returnValue.subject = rSubjectCommandResult[0].split(`"`)[1];
        remainingMessage = remainingMessage.replaceAll(
            rSubjectCommandResult[0],
            ""
        );
    }

    const rToCommand = new RegExp(toCommandPattern);
    const rToCommandResult = rToCommand.exec(message);
    if (rToCommandResult != null) {
        returnValue.to = rToCommandResult[0].split(`"`)[1];
        remainingMessage = remainingMessage.replaceAll(rToCommandResult[0], "");
    }

    returnValue.message = remainingMessage.trim();
    return returnValue;
};

const determineConnectionString = function (email: string): string {
    const domainName = email.split("@")[1].toLowerCase();

    // Determine the right connectionString;
    let connectionString = "";
    switch (domainName) {
        case "nip05.social":
            connectionString =
                EnvService.instance.env
                    .COMMUNICATION_SERVICES_CONNECTION_STRING_NIP05SOCIAL;
            break;

        case "nostrid.info":
            connectionString =
                EnvService.instance.env
                    .COMMUNICATION_SERVICES_CONNECTION_STRING_NOSTRIDINFO;
            break;

        case "nostrcom.com":
            connectionString =
                EnvService.instance.env
                    .COMMUNICATION_SERVICES_CONNECTION_STRING_NOSTRCOMCOM;
            break;

        case "nip05.cloud":
            connectionString =
                EnvService.instance.env
                    .COMMUNICATION_SERVICES_CONNECTION_STRING_NIP05CLOUD;
            break;

        case "unitednostr.com":
            connectionString =
                EnvService.instance.env
                    .COMMUNICATION_SERVICES_CONNECTION_STRING_UNITEDNOSTRCOM;
            break;

        case "protonostr.com":
            connectionString =
                EnvService.instance.env
                    .COMMUNICATION_SERVICES_CONNECTION_STRING_PROTONOSTRCOM;
            break;

        default:
            break;
    }

    return connectionString;
};

