import { PrismaClient } from "@prisma/client";
import { generatePrivateKey, getPublicKey } from "nostr-tools";
import { SystemUserKeyvaultType } from "../../common/keyvault-types/email-keyvault-type";
import { AzureSecretService } from "../../services/azure-secret-service";

const seed = async function (prisma: PrismaClient) {
    const emailOutHub = await prisma.systemUser.findUnique({
        where: { id: 1 },
    });
    if (!emailOutHub) {
        // Generate pubkey/privkey
        const privkey = generatePrivateKey();
        const pubkey = getPublicKey(privkey);
        const nip05 = "email_out@nip05.social";
        const keyvaultKey = "system-user--email--out--nip05--social";
        const keyvaultData: SystemUserKeyvaultType = {
            id: 1,
            nip05,
            pubkey,
            privkey,
        };

        await AzureSecretService.instance.trySetValue(
            keyvaultKey,
            JSON.stringify(keyvaultData)
        );

        const name = "NIP05.social Email Out [Bot]";
        const picture =
            "https://nip05assets.blob.core.windows.net/public/email-out-02.jpg";
        const banner =
            "https://nip05assets.blob.core.windows.net/public/profile-background-3.jpg";
        const about =
            `I handle outgoing emails for users on https://nip05.social\n\n` +
            `Send me a DM with the text "help", and I will answer with instructions about what I can do.`;

        await prisma.systemUser.create({
            data: {
                id: 1,
                keyvaultKey,
                pubkey,
                nip05,
                name,
                picture,
                banner,
                lookups: 0,
                about,
                systemUserRelays: {
                    createMany: {
                        data: [
                            {
                                id: 1,
                                url: "wss://nostr-pub.wellorder.net",
                            },
                            {
                                id: 2,
                                url: "wss://relay.damus.io",
                            },
                        ],
                    },
                },
            },
        });
    } else {
        // Update Case. Do nothing atm.
    }
};

export { seed as seedSystemUser };

