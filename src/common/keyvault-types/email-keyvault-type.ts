//
// WIll be stored in Azure Keyvault like this:
// email_<email>

export const emailKeyvaultTypeKeyPrefix = "email--";

export type EmailKeyvaultType = {
    email: string;
    pubkey: string;
    privkey: string;
};

