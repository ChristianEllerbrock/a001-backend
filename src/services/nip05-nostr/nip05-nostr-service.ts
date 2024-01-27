import { DateTime } from "luxon";
import { PrismaService } from "../prisma-service";
import { Event } from "nostr-tools";
import { AzureSecretService } from "../azure-secret-service";
import {
    KeyVaultType_Email,
    KeyVaultType_SystemUser,
    KeyVault_Bots_SecretName,
    KeyVault_Bots_Type,
} from "../../common/key-vault";
import { NostrConnector } from "../../nostr-v4/nostrConnector";
import { NostrDMWatcher } from "../../nostr-v4/nostrDMWatcher";
import {
    getReceiverDbEmailNostr,
    getReceiverDbSystemUser,
    getReceiverPubkeyFromKind4Event,
} from "./receiver-related";
import { findCommandInOutMessage, respondToCommand } from "./command-related";
import { log } from "./common";
import { checkSubscriptionAndRespondIfNecessary } from "./subscription-related";
import { sendEmailOut } from "./sendEmailOut";

const paidRelays: string[] = [
    "wss://nostr.wine",
    "wss://relay.snort.social",
    "wss://relay.orangepill.dev",
    "wss://relay.nostr.com.au",
];

const relaysWithoutKind4Support: string[] = [
    "wss://purplepag.es",
    "wss://nostr.coinfundit.com/",
];

export class Nip05NostrService {
    // #region Singleton
    static #instance: Nip05NostrService;

    static get instance() {
        if (this.#instance) {
            return this.#instance;
        }

        this.#instance = new Nip05NostrService();
        return this.#instance;
    }

    // #endregion Singleton

    #relayPubkeys = new Map<string, Set<string>>();
    public dmWatcher: NostrDMWatcher;

    /**
     * Store all event ids from incoming DMs that were processed or
     * are currently processed. Ignore any incoming event id that is
     * already included here.
     */
    #dmEventIds = new Map<string, Date>();

    constructor() {
        this.dmWatcher = new NostrDMWatcher();
    }

    // async start() {
    //     await this.#initialize();
    // }

    async watchForDMs(toPubkey: string, onRelays: string[]) {
        for (const relay of onRelays) {
            await this.dmWatcher.watch([relay, new Set<string>([toPubkey])]);
        }
    }

    killRandomRelayConnection() {
        this.dmWatcher.killRandomRelayConnection();
    }

    async sendDMFromBot(
        receiverPubkey: string,
        publishOnRelays: string[],
        text: string
    ): Promise<string[]> {
        // Get the bot pubkey and privkey for the connector.
        const bots =
            await AzureSecretService.instance.tryGetValue<KeyVault_Bots_Type>(
                KeyVault_Bots_SecretName
            );
        const bot = bots?.find((x) => x.id === 1);
        if (typeof bot === "undefined") {
            throw new Error("Could not get bot data from Azure Key Vault.");
        }

        const connector = new NostrConnector({
            pubkey: bot.pubkey,
            privkey: bot.privkey,
        });

        return await this.sendDM(
            connector,
            receiverPubkey,
            publishOnRelays,
            text
        );
    }

    async sendDM(
        connector: NostrConnector,
        receiverPubkey: string,
        publishOnRelays: string[],
        text: string
    ): Promise<string[]> {
        // A) Generate DM event.
        const event = await connector.generateDM(text, receiverPubkey);

        // B) Publish DM event to all relevant relays.
        return await this.dmWatcher.publishEvent(event, publishOnRelays);
    }

    async publishEvent(event: Event, toRelays: string[]): Promise<string[]> {
        return await this.dmWatcher.publishEvent(event, toRelays);
    }

    /**
     * This methods returns all relays that the user has configured for any
     * of his registrations plus all public relays configured in the database
     * plus all user configured NIP65 relays on any of these plus
     * "relay.nip05.social".
     */
    async getRelevantAccountRelays(pubkey: string): Promise<string[]> {
        const ownRelay = "wss://relay.nip05.social";

        const dbUser = await PrismaService.instance.db.user.findFirst({
            where: { pubkey },
            include: {
                registrations: {
                    include: { registrationRelays: true },
                },
            },
        });

        if (!dbUser) {
            return [ownRelay]; // No user account available.
        }

        const registrationRelays = dbUser.registrations
            .map((x) => x.registrationRelays.map((y) => y.address))
            .flat();
        const dbPublicRelays = (
            await PrismaService.instance.db.publicRelay.findMany({
                where: { isActive: true },
                select: { url: true },
            })
        ).map((x) => x.url);

        const databaseRelays = Array.from(
            new Set<string>([
                ownRelay,
                ...registrationRelays,
                ...dbPublicRelays,
            ])
        );
        const relevantRelays = await this.includeNip65Relays(
            pubkey,
            databaseRelays
        );
        return relevantRelays;
    }

    async includeNip65Relays(
        pubkey: string,
        initialRelays: string[]
    ): Promise<string[]> {
        if (initialRelays.length === 0) {
            return [];
        }

        const relayLists = await this.dmWatcher.fetchNip65RelayLists(
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

    async onDMEvent(
        event: Event,
        destination: "email-mirror" | "email-out-bot"
    ) {
        // Check, if the event already is (or was) processed.
        if (this.#dmEventIds.has(event.id)) {
            return;
        }

        log(event, "DM event received from pubkey " + event.pubkey);

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
            log(event, "Unknown sender. Ignore.");
            return;
        }

        // Get some data that will later be used.
        // Data: The sender's initial relays (stored in the NIP05.social database)
        const senderInitialRelays: string[] = ["wss://relay.nip05.social"];
        for (const dbRegistration of dbUser.registrations) {
            senderInitialRelays.push(
                ...dbRegistration.registrationRelays.map((x) => x.address)
            );
        }

        // Data: The receiver pubkey of the DM
        const receiverPubkey = getReceiverPubkeyFromKind4Event(event);
        if (!receiverPubkey) {
            log(
                event,
                "Could not determine receiver pubkey from event. Do nothing."
            );
            return;
        }

        // Data: The receiver database entries.
        // It could either be a record from emailNostr or systemUser.
        const receiverDbEmailNostr = await getReceiverDbEmailNostr(
            receiverPubkey
        );
        const receiverDbSystemUser = await getReceiverDbSystemUser(
            receiverPubkey
        );
        if (!receiverDbEmailNostr && !receiverDbSystemUser) {
            log(
                event,
                "Could not fetch the database record for the given receiver pubkey. Do nothing"
            );
            return;
        }
        const receiverIsSystemUser = !!receiverDbSystemUser;

        // Data: The receiver's connector object
        let receiverConnector: NostrConnector | undefined;
        if (receiverDbSystemUser) {
            const keyvaulData =
                await AzureSecretService.instance.tryGetValue<KeyVaultType_SystemUser>(
                    receiverDbSystemUser.keyvaultKey
                );
            if (keyvaulData) {
                receiverConnector = new NostrConnector({
                    pubkey: keyvaulData.pubkey,
                    privkey: keyvaulData.privkey,
                });
            }
        } else if (receiverDbEmailNostr) {
            const keyvaulData =
                await AzureSecretService.instance.tryGetValue<KeyVaultType_Email>(
                    receiverDbEmailNostr.email.keyvaultKey
                );
            if (keyvaulData) {
                receiverConnector = new NostrConnector({
                    pubkey: keyvaulData.pubkey,
                    privkey: keyvaulData.privkey,
                });
            }
        }

        if (!receiverConnector) {
            log(
                event,
                "Could not retrieve the keyvault data for the given receiver pubkey. Do nothing."
            );
            return;
        }

        // Data: the decrypted content of the DM
        const message = await receiverConnector.decryptDM(event);

        // Continue with all relevant data at hand.

        // Check, if the DM contains a COMMAND.
        const command = findCommandInOutMessage(
            message,
            receiverDbSystemUser?.id
        );
        if (command) {
            const relevantRelays = await this.includeNip65Relays(
                event.pubkey,
                senderInitialRelays
            );

            log(
                event,
                `DM includes COMMAND '${command}'. Will respond with a corresponding DM on ${relevantRelays.join(
                    ", "
                )}.`
            );

            await respondToCommand.call(
                this,
                command,
                event.pubkey,
                receiverConnector,
                relevantRelays
            );

            log(event, "Done");
            return;
        }

        // From a technical perspective everything looks good. We have all the
        // necessary data and the sender has NOT send us a COMMAND.
        // Continue.

        // Check if the user has a valid subscription
        const checkResult = await checkSubscriptionAndRespondIfNecessary.call(
            this,
            event,
            dbUser,
            receiverConnector,
            senderInitialRelays
        );
        if (!checkResult) {
            return; // No valid subscription.
        }

        //
        // CURRENTLY ONLY ALLOW CHRIS pubkey

        if (
            event.pubkey !==
            "090e4e48e07e331b7a9eb527532794969ab1086ddfa4d805fff88c6358e9d15d"
        ) {
            log(event, "DEBUG PHASE: ONLY Chris is allowed.");
            return;
        }

        // Determine the CURRENT user's NIP05.
        // TODO
        const dbFirstRegistration = dbUser.registrations[0];
        const senderEmail =
            dbFirstRegistration.identifier +
            "@" +
            dbFirstRegistration.systemDomain.name;
        log(event, `Will use email address as sender: ${senderEmail}`);

        // Everything is ok. We can send the email.
        const sendResult = await sendEmailOut.call(
            this,
            event,
            senderEmail,
            message,
            receiverDbEmailNostr,
            receiverDbSystemUser
        );

        if (!sendResult) {
            return;
        }

        // Send ok.
        // Store event info in database.
        if (sendResult.emailNostrId) {
            await PrismaService.instance.db.emailNostrDm.create({
                data: {
                    emailNostrId: sendResult.emailNostrId,
                    eventId: event.id,
                    eventCreatedAt: event.created_at,
                    sent: new Date(),
                },
            });
        } else if (sendResult.systemUserId) {
            await PrismaService.instance.db.systemUserDm.create({
                data: {
                    systemUserId: sendResult.systemUserId,
                    eventId: event.id,
                },
            });
        }

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
        log(
            event,
            `Sent ${dbRegistrationEmailOut.total} today on behalf of the user.`
        );
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

        log(undefined, `Purge ${keysToDelete.length} old DM event ids.`);
        keysToDelete.forEach((x) => {
            this.#dmEventIds.delete(x);
        });
    }
}

