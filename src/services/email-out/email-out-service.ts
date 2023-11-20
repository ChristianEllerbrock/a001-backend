import { DateTime } from "luxon";
import { PrismaService } from "../prisma-service";
import { Event } from "nostr-tools";
import { AzureSecretService } from "../azure-secret-service";
import { EmailKeyvaultType } from "../../common/keyvault-types/email-keyvault-type";
import { NostrConnector } from "../../nostr-v4/nostrConnector";
import { EmailClient } from "@azure/communication-email";
import { EnvService } from "../env-service";
import { AzureCommunicationService } from "../azure-communication-service";
import { NostrDMWatcher } from "../../nostr-v4/nostrDMWatcher";

const paidRelays: string[] = [
    "wss://nostr.wine",
    "wss://relay.snort.social",
    "wss://relay.orangepill.dev",
    "wss://relay.nostr.com.au",
];

type DbUser = {
    subscription: {
        id: number;
        name: string;
        satsPer30Days: number;
        maxNoOfNostrAddresses: number;
        maxNoOfInboundEmailsPer30Days: number;
        maxNoOfOutboundEmailsPer30Days: number;
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

const _log = function (event: Event | undefined, text: string) {
    const id =
        typeof event === "undefined" ? "system" : event.id.substring(0, 10);
    console.log(`EMAIL OUT - [${id}] - ${text}`);
};

export class EmailOutService {
    // #region Singleton
    static #instance: EmailOutService;

    static get instance() {
        if (this.#instance) {
            return this.#instance;
        }

        this.#instance = new EmailOutService();
        return this.#instance;
    }

    // #endregion Singleton

    #relayPubkeys = new Map<string, Set<string>>();
    #dmWatcher: NostrDMWatcher;

    /**
     * Store all event ids from incoming DMs that were processed or
     * are currently processed. Ignore any incoming event id that is
     * already included here.
     */
    #dmEventIds = new Map<string, Date>();

    //#healthTimer: NodeJS.Timer | undefined;

    constructor() {
        this.#dmWatcher = new NostrDMWatcher();
    }

    async start() {
        await this.#initialize();
    }

    killRandomRelayConnection() {
        this.#dmWatcher.killRandomRelayConnection();
    }

    async #initialize() {
        const start = DateTime.now();
        _log(undefined, "STARTUP start: " + start.toJSDate().toISOString());

        const pubkeys = new Set<string>();

        // First go through all the emailNostr records in the database.
        const dbEmailNostrs =
            await PrismaService.instance.db.emailNostr.findMany({
                include: { emailNostrProfiles: true },
            });
        for (const dbEmailNostr of dbEmailNostrs) {
            pubkeys.add(dbEmailNostr.pubkey);

            for (const profile of dbEmailNostr.emailNostrProfiles) {
                // Only add PUBLIC relays.
                if (paidRelays.includes(profile.publishedRelay)) {
                    continue;
                }

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

        // Now also include the systemUser records in the database.
        const dbSystemUsers =
            await PrismaService.instance.db.systemUser.findMany({
                include: { systemUserRelays: true },
            });
        for (const dbSystemUser of dbSystemUsers) {
            pubkeys.add(dbSystemUser.pubkey);

            for (const dbSystemUserRelay of dbSystemUser.systemUserRelays) {
                const record = this.#relayPubkeys.get(dbSystemUserRelay.url);
                if (typeof record === "undefined") {
                    this.#relayPubkeys.set(
                        dbSystemUserRelay.url,
                        new Set([dbSystemUser.pubkey])
                    );
                } else {
                    record.add(dbSystemUser.pubkey);
                }
            }
        }

        this.#dmWatcher.onDM(this.#onDMEvent.bind(this));

        for (const data of this.#relayPubkeys) {
            try {
                await this.#dmWatcher.watch([data[0], data[1]]);
            } catch (error) {
                // TODO
            }
        }

        const end = DateTime.now();
        _log(undefined, "STARTUP finished: " + end.toJSDate().toISOString());

        _log(
            undefined,
            "STARTUP #duration (seconds): " +
                end.diff(start, "seconds").toObject().seconds
        );

        _log(undefined, "STARTUP #relays: " + this.#relayPubkeys.size);

        _log(undefined, "STARTUP #pubkeys: " + pubkeys.size);
    }

    stop() {
        //clearInterval(this.#healthTimer);
        // if (!this.#subscriptionId) {
        //     return;
        // }
        // NostrRelayerService.instance.relayer.multiKind4SubscribeOff(
        //     this.#subscriptionId
        // );
    }

    async #onDMEvent(event: Event) {
        // Check, if the event already is (or was) processed.
        if (this.#dmEventIds.has(event.id)) {
            return;
        }

        _log(event, "DM event received from pubkey " + event.pubkey);

        // New event => Process
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
            // No user found in the database with the sender's pubkey. Ignore.
            _log(event, "Unknown sender. Ignore.");
            return;
        }

        // Get some data that will later be used.
        // Data: The sender's initial relays (stored in the NIP05.social database)
        const senderInitialRelays: string[] = [];
        for (const dbRegistration of dbUser.registrations) {
            senderInitialRelays.push(
                ...dbRegistration.registrationRelays.map((x) => x.address)
            );
        }

        // Data: The receiver pubkey of the DM
        const receiverPubkey = this.#getReceiverPubkeyFromKind4Event(event);
        if (!receiverPubkey) {
            _log(
                event,
                "Could not determine receiver pubkey from event. Do nothing."
            );
            return;
        }

        // Data: The receiver database entries.
        const receiverDbEmailNostr = await this.#getReceiverDbEmailNostr(
            receiverPubkey
        );
        if (!receiverDbEmailNostr) {
            _log(
                event,
                "Could not fetch the emailNostr record from the database for the given receiver pubkey. Do nothing"
            );
            return;
        }

        // Data: The receiver's kevault entry (incl. privkey)
        const receiverKeyvault = await this.#getReceiverKeyvaultRecord(
            receiverDbEmailNostr.email.keyvaultKey
        );
        if (!receiverKeyvault) {
            _log(
                event,
                "Could not retrieve the keyvault data for the emailNostr record."
            );
            return;
        }

        // Data: The receiver's connector object
        const receiverConnector = new NostrConnector({
            pubkey: receiverKeyvault.pubkey,
            privkey: receiverKeyvault.privkey,
        });

        // Data: the decrypted content of the DM
        const message = await receiverConnector.decryptDM(event);

        // Continue with all relevant data at hand.

        // Check, if the DM contains a COMMAND.
        const command = this.#analyzeIntendedOutMessageForCommands(message);
        if (command === "help") {
            // Send help DM back. DO NOT CREATE EMAIL.
            const relevantRelays = await this.#includeNip65Relays(
                event.pubkey,
                senderInitialRelays
            );

            _log(
                event,
                `DM includes COMMAND '${command}'. Will respond with a corresponding DM on ${relevantRelays.join(
                    ", "
                )}.`
            );

            await this.#sendDM(
                receiverConnector,
                event.pubkey,
                relevantRelays,
                this.#getCommandResponseText(command)
            );
            _log(event, "Done");
            return;
        }

        // From a technical perspective everything looks good. We have all the
        // necessary data and the sender has NOT send us a COMMAND.
        // Continue.

        // Check if the user has a valid subscription
        // for OUTBOUND EMAIL FORWARDING.
        const checkResult = await this.#checkSubscription(dbUser);
        _log(
            event,
            "Subscription check (for user's 30-day-period): " +
                checkResult +
                " for " +
                event.pubkey
        );

        if (typeof checkResult === "undefined") {
            // The user's subscription does NOT cover EMAIL OUT
            // TODO: Answer DM
            const relevantRelays = await this.#includeNip65Relays(
                event.pubkey,
                senderInitialRelays
            );
            _log(
                event,
                `Respond with DM: The user's subscription does NOT cover EMAIL OUT. Publish on ${relevantRelays.join(
                    ", "
                )}`
            );
            let text =
                "== MESSAGE FROM NIP05.social\n\n" +
                "Your current subscription does not include OUTBOUND EMAIL FORWARDING. " +
                "Please subscribe to a higher plan on\n\n" +
                "https://nip05.social";

            await this.#sendDM(
                receiverConnector,
                event.pubkey,
                relevantRelays,
                text
            );
            _log(event, "Done");

            return;
        } else if (checkResult === 0) {
            // The user has exhausted his contingent in this 30-day-period.
            const relevantRelays = await this.#includeNip65Relays(
                event.pubkey,
                senderInitialRelays
            );
            _log(
                event,
                `Respond with DM: The user has exhausted his contingent for EMAIL OUT. Publish on ${relevantRelays.join(
                    ", "
                )}`
            );
            let text =
                "== MESSAGE FROM NIP05.social\n\n" +
                `You have exhausted your maximum number of allowed outbound emails per 30 day period (${dbUser.subscription.maxNoOfOutboundEmailsPer30Days}). `;

            // 2 Situations: No more next period or more next period(s)
            const nextPeriodStart = this.#determineNextPeriodStart(
                dbUser.subscriptionEnd
            );

            if (nextPeriodStart) {
                text += `Please wait until the next period starts (at ${nextPeriodStart
                    .toUTC()
                    .toFormat(
                        "yyyy-MM-dd HH:mm"
                    )} UTC), or subscribe to a higher plan on \n\n`;
                text += "https://nip05.social";
            } else {
                text += `Your subscription ends at ${DateTime.fromJSDate(
                    dbUser.subscriptionEnd ?? new Date()
                )
                    .toUTC()
                    .toFormat(
                        "yyyy-MM-dd HH:mm"
                    )} (UTC). Please consider prolonging your subscription on\n\n`;
                text += "https://nip05.social";
            }

            await this.#sendDM(
                receiverConnector,
                event.pubkey,
                relevantRelays,
                text
            );

            _log(event, "Done");

            return;
        }

        //
        // CURRENTLY ONLY ALLOW CHRIS pubkey

        if (
            event.pubkey !==
            "090e4e48e07e331b7a9eb527532794969ab1086ddfa4d805fff88c6358e9d15d"
        ) {
            _log(event, "DEBUG PHASE: ONLY Chris is allowed.");
            return;
        }

        // Determine the CURRENT user's NIP05.
        // TODO
        const dbFirstRegistration = dbUser.registrations[0];
        const senderEmail =
            dbFirstRegistration.identifier +
            "@" +
            dbFirstRegistration.systemDomain.name;
        _log(event, `Will use email address as sender: ${senderEmail}`);

        // Everything is ok. We can send the email.
        const emailNostrId = await this.#sendEmailOut(
            event,
            senderEmail,
            message,
            receiverPubkey
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
                event,
                `Sent ${dbRegistrationEmailOut.total} today on behalf of the user.`
            );
        }
    }

    async #sendEmailOut(
        event: Event,
        senderEmail: string,
        senderMessage: string,
        receiverPubkey: string
    ): Promise<number | undefined> {
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
            _log(event, "No email receiver record found in database.");
            return;
        }

        // Check if the intended email was already sent.
        if (
            dbEmailNostr.emailNostrDms.find(
                (x) => x.eventId === event.id && typeof x.sent !== "undefined"
            )
        ) {
            _log(event, "DM was already sent. Do nothing");
            return;
        }

        const splitMessage = this.#splitMessageInSubjectAndRest(senderMessage);

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
        publishOnRelays: string[],
        text: string
    ) {
        // A) Generate DM event.
        const event = await connector.generateDM(text, receiverPubkey);

        // B) Publish DM event to all relevant relays.
        await this.#dmWatcher.publishEvent(event, publishOnRelays);
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
            dbUser.subscription.maxNoOfOutboundEmailsPer30Days;

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

        _log(undefined, `Purge ${keysToDelete.length} old DM event ids.`);
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

    #getReceiverPubkeyFromKind4Event(event: Event): string | undefined {
        for (const tag of event.tags) {
            if (tag[0] !== "p") {
                continue;
            }

            return tag[1];
        }

        return undefined;
    }

    async #getReceiverDbEmailNostr(receiverPubkey: string): Promise<
        | ({
              email: {
                  id: number;
                  address: string;
                  createdAt: Date;
                  keyvaultKey: string;
              };
              emailNostrProfiles: {
                  id: number;
                  emailNostrId: number;
                  publishedAt: Date;
                  publishedRelay: string;
              }[];
              emailNostrDms: {
                  id: number;
              }[];
          } & {
              id: number;
              emailId: number;
              pubkey: string;
              nip05: string;
              name: string | null;
              about: string | null;
              picture: string | null;
              banner: string | null;
              lookups: number;
              lastLookupDate: Date | null;
          })
        | null
    > {
        return await PrismaService.instance.db.emailNostr.findFirst({
            where: {
                pubkey: receiverPubkey,
            },
            include: {
                email: true,
                emailNostrDms: true,
                emailNostrProfiles: true,
            },
        });
    }

    async #getReceiverKeyvaultRecord(keyvaultKey: string) {
        return await AzureSecretService.instance.tryGetValue<EmailKeyvaultType>(
            keyvaultKey
        );
    }

    #determineNextPeriodStart(
        subscriptionEnd: Date | undefined | null
    ): DateTime | undefined {
        if (!subscriptionEnd) {
            return undefined;
        }

        const now = new Date();
        if (subscriptionEnd.getTime() < now.getTime()) {
            return undefined; // Subscription already has ended.
        }

        let movingDateTime = DateTime.fromJSDate(subscriptionEnd);
        do {
            movingDateTime = movingDateTime.plus({ days: -30 });
        } while (movingDateTime.toJSDate().getTime() > now.getTime());

        const nextPeriodStart = movingDateTime.plus({ days: 30 });
        if (nextPeriodStart.toJSDate().getTime() > subscriptionEnd.getTime()) {
            return undefined; // The next period is after subscription end.
        }

        return nextPeriodStart;
    }

    async #includeNip65Relays(
        pubkey: string,
        initialRelays: string[]
    ): Promise<string[]> {
        const relayLists = await this.#dmWatcher.fetchNip65RelayLists(
            pubkey,
            initialRelays
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
        return destinationRelays;
    }
}

