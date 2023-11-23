import { NostrConnector } from "../../nostr-v4/nostrConnector";
import { EmailOutService } from "./email-out-service";

export enum SystemUserCommand {
    EmailOutHub_HELP = "email-out-hub_help",
}

export enum EmailMirrorCommand {
    Help = "email-mirror_help",
}

export const findCommandInOutMessage = function (
    message: string,
    systemUserId: number | undefined
) {
    if (systemUserId) {
        return findCommandInOutMessageForSystemUser(systemUserId, message);
    }

    return findCommandInOutMessageForEmailMirror(message);
};

export const findCommandInOutMessageForSystemUser = function (
    systemUserId: number,
    message: string
): SystemUserCommand | undefined {
    // systemUserId: 1 (Email Out Hub)

    if (systemUserId === 1) {
        if (message.toLowerCase().trim() === "help") {
            return SystemUserCommand.EmailOutHub_HELP;
        }

        return undefined;
    }

    return undefined;
};

export const findCommandInOutMessageForEmailMirror = function (
    message: string
): EmailMirrorCommand | undefined {
    if (message.toLowerCase().trim() === "help") {
        return EmailMirrorCommand.Help;
    }

    return undefined;
};

export const respondToCommand = async function (
    this: EmailOutService,
    command: SystemUserCommand | EmailMirrorCommand,
    senderPubkey: string,
    receiverConnector: NostrConnector,
    publishRelays: string[]
): Promise<void> {
    let text = "";

    if (command === EmailMirrorCommand.Help) {
        text =
            "Hi, I am an account that was automatically created to handle INBOUND and OUTBOUND #email forwarding for #nostr addresses registered on";
        text += "\n\n";
        text += "https://nip05.social";

        text += "\n\n";
        text += "I handle exactly one #email address.";

        text += "\n\n";
        text +=
            "If you are a registered user and have activated INBOUND #email forwarding for a specific #nostr address, " +
            "you will receive #emails to this address as direct messages from either me or one of the other mirror-accounts.";

        text += "\n\n";

        text +=
            "If you send me a message, I will handle the OUTBOUND #email forwarding by generating an #email with the content of your message and sending" +
            " it to the #email address that I mirror.";

        text += "\n\n";
        text +=
            "As subject for the #email, I will use a default that you can configure in your account. If you want " +
            "to set the subject yourself, you have to start your message like this:";

        text += "\n\n";
        text += '-s "your subject goes here"\n';
    } else if (command === SystemUserCommand.EmailOutHub_HELP) {
        text =
            "Hi, I handle OUTBOUND #email forwarding for #nostr addresses registered on";
        text += "\n\n";
        text += "https://nip05.social";

        text += "\n\n";
        text +=
            "You can send me a message IN A VERY SPECIFIC FORMAT and I will generate an #email from it.";
        text +=
            " The message must include the intended #email address of the receiver (mandatory), the intended subject";
        text += " (optional) and the intended message like this:";

        text += "\n\n";
        text += '-to "darth.vader@deathstar.com"\n';
        text += '-s "Your subject goes here"\n';
        text += "...";
        text += "\n\n";
        text +=
            "If you do not include a subject, I will use a default that you can configure in your account. ";
    }

    await this.sendDM(receiverConnector, senderPubkey, publishRelays, text);
    return;
};

