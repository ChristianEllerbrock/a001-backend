import { Arg, Authorized, Ctx, Query, Resolver } from "type-graphql";
import { StatOutput } from "../outputs/stat-output";
import { GraphqlContext } from "../type-defs";
import { RelayInfoOutput } from "../outputs/admin/relay-info-output";
import { Nip05NostrService } from "../../services/nip05-nostr/nip05-nostr-service";
import { AzureSecretService } from "../../services/azure-secret-service";
import {
    KeyPair,
    KeyVault_Admin_SecretName,
    KeyVault_Admin_Type,
    KeyVault_Chris_SecretName,
    KeyVault_Chris_Type,
} from "../../common/key-vault";
import { NostrConnector } from "../../nostr-v4/nostrConnector";

@Resolver()
export class AdminResolver {
    @Authorized()
    @Query((returns) => StatOutput, { nullable: true })
    async adminStats(
        @Ctx() context: GraphqlContext
    ): Promise<StatOutput | null> {
        const isSystemUser = await context.user?.isSystemUser();
        if (!isSystemUser) {
            return null;
        }

        // The requester is system user (admin)- Provide data.

        const dbDailyLookups = await context.db.dailyLookup.findMany({
            orderBy: {
                date: "desc",
            },
            take: 1,
        });
        const dbDailyLookup =
            dbDailyLookups.length === 1 ? dbDailyLookups[0] : undefined;

        const dbStatUsers = await context.db.statUser.findMany({
            orderBy: {
                date: "desc",
            },
            take: 1,
        });
        const dbStatUser =
            dbStatUsers.length === 1 ? dbStatUsers[0] : undefined;

        const statOutput: StatOutput = {
            noOfUsersDate: dbStatUser?.date ?? new Date(),
            noOfUsers: dbStatUser?.users ?? 0,
            noOfLookupsDate: dbDailyLookup?.date ?? new Date(),
            noOfLookups: dbDailyLookup?.nipped ?? 0,
        };
        return statOutput;
    }

    @Authorized()
    @Query((returns) => [RelayInfoOutput])
    async admRelayInfos(
        @Ctx() context: GraphqlContext
    ): Promise<RelayInfoOutput[]> {
        const isSystemUser = await context.user?.isSystemUser();
        if (!isSystemUser) {
            throw new Error("Unauthorized.");
        }

        const relayInfos = Nip05NostrService.instance.dmWatcher.getRelayInfos();
        return relayInfos.map((x) => {
            return {
                url: x.url,
                status: x.status,
                noOfWatchedPubkeys: x.watchedPubkeys.length,
                noOfDisconnects: x.noOfDisconnects,
                averageTimeBetweenDisconnects: x.averageTimeBetweenDisconnects,
                averageUptime: x.averageUptime,
            };
        });
    }

    @Authorized()
    @Query((returns) => [String])
    async admSendDM(
        @Ctx() context: GraphqlContext,
        @Arg("toPubkey") toPubkey: string,
        @Arg("text") text: string,
        @Arg("from") from: "admin" | "chris"
    ): Promise<string[]> {
        const relevantRelays =
            await Nip05NostrService.instance.getRelevantAccountRelays(toPubkey);
        if (relevantRelays.empty()) {
            return [];
        }

        let keyPair: KeyPair | undefined;

        if (from === "admin") {
            keyPair =
                await AzureSecretService.instance.tryGetValue<KeyVault_Admin_Type>(
                    KeyVault_Admin_SecretName
                );
        } else if (from === "chris") {
            keyPair =
                await AzureSecretService.instance.tryGetValue<KeyVault_Chris_Type>(
                    KeyVault_Chris_SecretName
                );
        } else {
            return [];
        }

        if (!keyPair) {
            return [];
        }

        const connector = new NostrConnector({
            pubkey: keyPair.pubkey,
            privkey: keyPair.privkey,
        });
        return await Nip05NostrService.instance.sendDM(
            connector,
            toPubkey,
            relevantRelays,
            text
        );
    }
}

