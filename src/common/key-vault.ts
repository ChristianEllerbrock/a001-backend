//
// WIll be stored in Azure Keyvault like this:
// email_<email>

export type KeyPair = {
    pubkey: string;
    privkey: string;
};

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

export const KeyVault_Admin_SecretName = "admin";
export type KeyVault_Admin_Type = KeyPair;

export const KeyVault_Chris_SecretName = "chris";
export type KeyVault_Chris_Type = KeyPair;

