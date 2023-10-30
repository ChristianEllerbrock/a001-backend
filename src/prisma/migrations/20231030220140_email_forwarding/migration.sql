BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[Registration] ADD [emailForwardingOn] BIT;

-- CreateTable
CREATE TABLE [dbo].[RegistrationEmailForwarding] (
    [id] INT NOT NULL IDENTITY(1,1),
    [registrationId] NVARCHAR(1000) NOT NULL,
    [date] DATETIME2 NOT NULL,
    [total] INT NOT NULL,
    CONSTRAINT [RegistrationEmailForwarding_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [RegistrationEmailForwarding_registrationId_date_key] UNIQUE NONCLUSTERED ([registrationId],[date])
);

-- CreateTable
CREATE TABLE [dbo].[Email] (
    [id] INT NOT NULL IDENTITY(1,1),
    [address] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL,
    [keyvaultKey] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [Email_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Email_address_key] UNIQUE NONCLUSTERED ([address])
);

-- CreateTable
CREATE TABLE [dbo].[EmailNostr] (
    [id] INT NOT NULL IDENTITY(1,1),
    [emailId] INT NOT NULL,
    [pubkey] NVARCHAR(1000) NOT NULL,
    [nip05] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000),
    [about] NVARCHAR(1000),
    [picture] NVARCHAR(1000),
    [banner] NVARCHAR(1000),
    [lookups] INT NOT NULL,
    CONSTRAINT [EmailNostr_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [EmailNostr_emailId_key] UNIQUE NONCLUSTERED ([emailId])
);

-- CreateTable
CREATE TABLE [dbo].[EmailNostrProfile] (
    [id] INT NOT NULL IDENTITY(1,1),
    [emailNostrId] INT NOT NULL,
    [publishedAt] DATETIME2 NOT NULL,
    [publishedRelay] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [EmailNostrProfile_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- AddForeignKey
ALTER TABLE [dbo].[RegistrationEmailForwarding] ADD CONSTRAINT [RegistrationEmailForwarding_registrationId_fkey] FOREIGN KEY ([registrationId]) REFERENCES [dbo].[Registration]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[EmailNostr] ADD CONSTRAINT [EmailNostr_emailId_fkey] FOREIGN KEY ([emailId]) REFERENCES [dbo].[Email]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[EmailNostrProfile] ADD CONSTRAINT [EmailNostrProfile_emailNostrId_fkey] FOREIGN KEY ([emailNostrId]) REFERENCES [dbo].[EmailNostr]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
