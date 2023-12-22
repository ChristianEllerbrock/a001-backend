import { Event } from "nostr-tools";
import { PrismaService } from "../prisma-service";
import {
    KeyVaultType_Email,
    KeyVaultType_SystemUser,
} from "../../common/key-vault";
import { AzureSecretService } from "../azure-secret-service";

export const getReceiverDbEmailNostr = async function (
    receiverPubkey: string
): Promise<
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
              emailNostrId: number;
              eventId: string;
              eventCreatedAt: number;
              sent: Date | null;
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
};

export const getReceiverDbSystemUser = async function (receiverPubkey: string) {
    return await PrismaService.instance.db.systemUser.findFirst({
        where: {
            pubkey: receiverPubkey,
        },
        include: {
            systemUserRelays: true,
            systemUserDms: true,
        },
    });
};

export const getReceiverPubkeyFromKind4Event = function (
    event: Event
): string | undefined {
    for (const tag of event.tags) {
        if (tag[0] !== "p") {
            continue;
        }

        return tag[1];
    }

    return undefined;
};

