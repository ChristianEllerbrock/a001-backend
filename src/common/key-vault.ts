//
// WIll be stored in Azure Keyvault like this:
// email_<email>

export const emailKeyvaultTypeKeyPrefix = "email--";

export type KeyVaultType_Email = {
    email: string;
    pubkey: string;
    privkey: string;
};

export type KeyVaultType_SystemUser = {
    id: number;
    nip05: string;
    pubkey: string;
    privkey: string;
};

export const KeyVault_Bots_SecretName = "agents";
export type KeyVault_Bots_Type = Array<{
    id: number;
    pubkey: string;
    privkey: string;
}>;

