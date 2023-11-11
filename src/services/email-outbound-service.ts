import { DateTime } from "luxon";
import { PrismaService } from "./prisma-service";
import { NostrRelayerService } from "./nostr-relayer.service";
import { Event, nip04, nip44 } from "nostr-tools";
import { User } from "@prisma/client";
import { AzureSecretService } from "./azure-secret-service";
import { EmailKeyvaultType } from "../common/keyvault-types/email-keyvault-type";
import { NostrConnector } from "../nostr-v4/nostrConnector";
import { EmailClient } from "@azure/communication-email";
import { EnvService } from "./env-service";
import { AzureCommunicationService } from "./azure-communication-service";

type DbUser = {
    subscription: {
        id: number;
        name: string;
        satsPerMonth: number;
        maxNoOfNostrAddresses: number;
        maxNoOfInboundEmailsPerMOnth: number;
        maxNoOfOutboundEmailsPerMonth: number;
    };
} & {
    id: string;
    pubkey: string;
    createdAt: Date;
    isSystemUser: boolean | null;
    fraudReportedAt: Date | null;
    isSystemAgent: boolean;
    subscriptionId: number;
    subscriptionEnd: Date | null;
};

type DMCommand = "help";

const _log = function (text: string) {
    console.log("EMAIL OUT - " + text);
};

export class EmailOutboundService {
    static #instance: EmailOutboundService;

    static get instance() {
        if (this.#instance) {
            return this.#instance;
        }

        this.#instance = new EmailOutboundService();
        return this.#instance;
    }

    // #endregion Singleton

    #relayPubkeys = new Map<string, Set<string>>();
    #subscriptionId: string | undefined;

    // Store all event ids from DM that were processed or
    // are currently processed. Ignore any incoming event id that is
    // already included here.
    #dmEventIds = new Map<string, Date>();

    async start() {
        this.stop();
        this.#subscriptionId = await this.#initialize();
    }

    stop() {
        if (!this.#subscriptionId) {
            return;
        }
        NostrRelayerService.instance.relayer.multiKind4SubscribeOff(
            this.#subscriptionId
        );
    }

    async #onDMEvent(event: Event) {
        _log("DM event received from pubkey " + event.pubkey);
        if (this.#dmEventIds.has(event.id)) {
            _log("DM was already processed or is currently being processed.");
            return;
        }

        // New event id => Process
        this.#dmEventIds.set(event.id, new Date());
        this.#purgeOldDmEventIds();

        // Check if the DM was sent from an allowed sender (i.e. a NIP05.social user).
        const dbUser = await PrismaService.instance.db.user.findFirst({
            where: { pubkey: event.pubkey },
            include: {
                subscription: true,
                registrations: {
                    include: { systemDomain: true, registrationRelays: true },
                },
            },
        });
        if (!dbUser) {
            // Not user found in the database. Ignore.
            _log("Unknown pubkey " + event.pubkey);
            return;
        }

        // Check if the user has a valid subscription
        // for OUTBOUND EMAIL FORWARDING.
        const checkResult = await this.#checkSubscription(dbUser);
        _log(
            "Subscription check (for user's 30-day-period): " +
                checkResult +
                " for " +
                event.pubkey
        );

        if (typeof checkResult === "undefined") {
            // The user's subscription does NOT cover EMAIL OUT
            // TODO: Answer DM
            return;
        } else if (checkResult === 0) {
            // The user has exhausted his contingent in this 30-day-period.
            // TODO: Answer DM
            return;
        }

        //
        // CURRENTLY ONLY ALLOW CHRIS pubkey

        if (
            event.pubkey !==
            "090e4e48e07e331b7a9eb527532794969ab1086ddfa4d805fff88c6358e9d15d"
        ) {
            _log("DEBUG PHASE: ONLY Chris is allowed.");
            return;
        }

        // Determine the CURRENT user's NIP05.
        // TODO
        const dbFirstRegistration = dbUser.registrations[0];
        const senderEmail =
            dbFirstRegistration.identifier +
            "@" +
            dbFirstRegistration.systemDomain.name;
        _log(`Will use email address as sender: ${senderEmail}`);

        // Everything is ok. We can send the email.
        const emailNostrId = await this.#sendEmailOutOrDMResponse(
            event,
            senderEmail,
            dbFirstRegistration.registrationRelays.map((x) => x.address)
        );

        if (emailNostrId) {
            // Send ok.

            // Store event info in database.
            await PrismaService.instance.db.emailNostrDm.create({
                data: {
                    emailNostrId,
                    eventId: event.id,
                    eventCreatedAt: event.created_at,
                    sent: new Date(),
                },
            });

            // Update user stats.
            const dbRegistrationEmailOut =
                await PrismaService.instance.db.registrationEmailOut.upsert({
                    where: {
                        registrationId_date: {
                            registrationId: dbFirstRegistration.id,
                            date: DateTime.now().startOf("day").toJSDate(),
                        },
                    },
                    update: { total: { increment: 1 } },
                    create: {
                        registrationId: dbFirstRegistration.id,
                        date: DateTime.now().startOf("day").toJSDate(),
                        total: 1,
                    },
                });
            _log(
                `Sent ${dbRegistrationEmailOut.total} today on behalf of the user.`
            );
        }
    }

    async #sendEmailOutOrDMResponse(
        event: Event,
        senderEmail: string,
        senderRegistrationRelays: string[]
    ): Promise<number | undefined> {
        // Determine the receiver pubkey.
        let receiverPubkey: string | undefined;
        for (const tag of event.tags) {
            if (tag[0] !== "p") {
                continue;
            }

            receiverPubkey = tag[1];
            break;
        }

        if (!receiverPubkey) {
            _log("Could not get receiver pubkey from DM event.");
            return;
        }

        const dbEmailNostr =
            await PrismaService.instance.db.emailNostr.findFirst({
                where: {
                    pubkey: receiverPubkey,
                },
                include: {
                    email: true,
                    emailNostrDms: true,
                    emailNostrProfiles: true,
                },
            });

        if (!dbEmailNostr) {
            _log("No email receiver record found in database.");
            return;
        }

        const keyvaultResult =
            await AzureSecretService.instance.tryGetValue<EmailKeyvaultType>(
                dbEmailNostr.email.keyvaultKey
            );
        if (!keyvaultResult) {
            _log(
                "Could not retrieve data from Azure KeyVault for secret " +
                    dbEmailNostr.email.keyvaultKey
            );
            return;
        }

        // Decrypt message.
        const connector = new NostrConnector({
            pubkey: keyvaultResult.pubkey,
            privkey: keyvaultResult.privkey,
        });
        const message = await connector.decryptDM(event);

        // Check if the message includes commands (like help)
        const command = this.#analyzeIntendedOutMessageForCommands(message);
        if (command === "help") {
            // Send help DM back. DO NOT CREATE EMAIL.
            _log("HELP command received. Will respond with a DM.");
            await this.#sendDM(
                connector,
                event.pubkey,
                senderRegistrationRelays,
                this.#getCommandResponseText(command)
            );
            _log("Done.");
            return;
        }

        // Check if the intended email was already sent.
        if (
            dbEmailNostr.emailNostrDms.find(
                (x) => x.eventId === event.id && typeof x.sent !== "undefined"
            )
        ) {
            _log("DM was already sent. Do nothing");
            return;
        }

        const splitMessage = this.#splitMessageInSubjectAndRest(message);

        // Make sure that the email exists in Azure as sender.
        await AzureCommunicationService.instance.addEmail(senderEmail);

        // Send Email.
        const client = new EmailClient(
            EnvService.instance.env.COMMUNICATION_SERVICES_CONNECTION_STRING
        );
        const emailMessage = {
            senderAddress: senderEmail,
            content: {
                subject: splitMessage[0] ?? "Nostr 2 Email",
                plainText: splitMessage[1],
            },
            recipients: {
                to: [{ address: dbEmailNostr.email.address }],
            },
        };
        // https://learn.microsoft.com/en-us/azure/communication-services/quickstarts/email/add-multiple-senders-mgmt-sdks?pivots=programming-language-javascript
        const poller = await client.beginSend(emailMessage);
        await poller.pollUntilDone();
        return dbEmailNostr.id;
    }

    #analyzeIntendedOutMessageForCommands(message: string): "help" | undefined {
        if (message.toLowerCase().trim() === "help") {
            return "help";
        }

        return undefined;
    }

    async #sendDM(
        connector: NostrConnector,
        receiverPubkey: string,
        initialRelays: string[],
        text: string
    ) {
        // A) Fetch NIP-65 relay lists from the initial relays.
        const relayLists =
            await NostrRelayerService.instance.fetchRelayListForPubkey(
                receiverPubkey,
                Array.from(new Set(initialRelays))
            );
        const destinationRelays = Array.from(
            new Set<string>([
                ...initialRelays,
                ...relayLists
                    .filter(
                        (x) =>
                            x.operation === "read" ||
                            x.operation === "read+write"
                    )
                    .map((x) => x.url),
            ])
        );

        // B) Generate DM event.
        const event = await connector.generateDM(text, receiverPubkey);

        // C) Publish DM event to all relevant relays.
        await NostrRelayerService.instance.relayer.publishEventAsync(
            event,
            destinationRelays
        );
    }

    async #initialize() {
        const start = DateTime.now();
        _log("STARTUP start: " + start.toJSDate().toISOString());

        const pubkeys = new Set<string>();

        const dbEmailNostrs =
            await PrismaService.instance.db.emailNostr.findMany({
                include: { emailNostrProfiles: true },
            });

        for (const dbEmailNostr of dbEmailNostrs) {
            pubkeys.add(dbEmailNostr.pubkey);

            for (const profile of dbEmailNostr.emailNostrProfiles) {
                const record = this.#relayPubkeys.get(profile.publishedRelay);
                if (typeof record === "undefined") {
                    this.#relayPubkeys.set(
                        profile.publishedRelay,
                        new Set([dbEmailNostr.pubkey])
                    );
                } else {
                    record.add(dbEmailNostr.pubkey);
                }
            }
        }

        const subscriptionId =
            NostrRelayerService.instance.relayer.multiKind4SubscribeOn(
                this.#relayPubkeys,
                this.#onDMEvent.bind(this),
                300
            );

        const end = DateTime.now();
        _log("STARTUP finished: " + end.toJSDate().toISOString());

        _log(
            "STARTUP #duration (seconds): " +
                end.diff(start, "seconds").toObject().seconds
        );

        _log("STARTUP #relays: " + this.#relayPubkeys.size);

        _log("STARTUP #pubkeys: " + pubkeys.size);

        return subscriptionId;
    }

    /**
     * Returns "undefined" if the user's subscription does NOT include EMAIL OUT.
     *
     * Returns a number if the the user's subscription in general allows EMAIL OUT.
     * The number is "-1", if the user has NO limits and any other number >= 0, indicating
     * how many emails the user can send with his current subscription in the
     * current 30-day-period.
     */
    async #checkSubscription(dbUser: DbUser): Promise<number | undefined> {
        const maxNoOfOutboundEmailsPerMonth =
            dbUser.subscription.maxNoOfOutboundEmailsPerMonth;

        if (maxNoOfOutboundEmailsPerMonth === -1) {
            return -1;
        }

        if (maxNoOfOutboundEmailsPerMonth === 0) {
            return undefined;
        }

        const now = DateTime.now();
        if (
            !dbUser.subscriptionEnd ||
            dbUser.subscriptionEnd.getTime() < now.toJSDate().getTime()
        ) {
            return undefined;
        }

        // We now have to check whether user user already has
        // exhausted his limits.
        let endDateTime = DateTime.fromJSDate(dbUser.subscriptionEnd);
        do {
            endDateTime = endDateTime.plus({ days: -30 });
        } while (endDateTime.toJSDate().getTime() > now.toJSDate().getTime());

        const checkStart = endDateTime
            .plus({ days: 1 })
            .startOf("day")
            .toJSDate();

        const dbOutsInCurrentPeriod =
            await PrismaService.instance.db.registrationEmailOut.findMany({
                include: {
                    registration: true,
                },
                where: {
                    date: { gte: checkStart },
                    registration: {
                        userId: dbUser.id,
                    },
                },
            });

        const outsInCurrentPeriod = dbOutsInCurrentPeriod
            .map((x) => x.total)
            .reduce((accumulator, currentValue) => {
                return accumulator + currentValue;
            }, 0);

        return maxNoOfOutboundEmailsPerMonth - outsInCurrentPeriod;
    }

    /**
     *  Remove all entries that are older than 7 days.
     */
    #purgeOldDmEventIds() {
        const now = DateTime.now();

        const keysToDelete: string[] = [];
        for (const data of this.#dmEventIds) {
            const dataDateTime = DateTime.fromJSDate(data[1]);
            if (dataDateTime.diff(now, "days").days > 7) {
                keysToDelete.push(data[0]);
            }
        }

        if (keysToDelete.length === 0) {
            return;
        }

        _log(`Purge ${keysToDelete.length} old DM event ids.`);
        keysToDelete.forEach((x) => {
            this.#dmEventIds.delete(x);
        });
    }

    #splitMessageInSubjectAndRest(
        message: string
    ): [string | undefined, string] {
        const patternFull = /^-s "[^"]+"/i;
        const rFull = new RegExp(patternFull);
        const rFullResult = rFull.exec(message);

        if (rFullResult == null) {
            return [undefined, message];
        }

        const patternSubject = /"[^"]+"/;
        const rSubject = new RegExp(patternSubject);
        const rSubjectResult = rSubject.exec(message);
        if (rSubjectResult == null) {
            return [undefined, message];
        }

        const patternMatch = rSubjectResult[0];

        const subject = patternMatch.substring(1, patternMatch.length - 1);
        return [subject, message.replace(rFullResult[0], "").trimStart()];
    }

    #getCommandResponseText(command: DMCommand): string {
        let text = "";
        if (command === "help") {
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
        }

        return text;
    }
}

