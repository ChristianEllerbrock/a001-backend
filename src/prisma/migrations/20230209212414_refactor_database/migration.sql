BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[User] (
    [id] NVARCHAR(1000) NOT NULL,
    [pubkey] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL,
    CONSTRAINT [User_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [User_pubkey_key] UNIQUE NONCLUSTERED ([pubkey])
);

-- CreateTable
CREATE TABLE [dbo].[Registration] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [identifier] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL,
    [validUntil] DATETIME2 NOT NULL,
    [verifiedAt] DATETIME2,
    CONSTRAINT [Registration_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[RegistrationCode] (
    [id] NVARCHAR(1000) NOT NULL,
    [registrationId] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL,
    [validUntil] DATETIME2 NOT NULL,
    CONSTRAINT [RegistrationCode_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [RegistrationCode_registrationId_key] UNIQUE NONCLUSTERED ([registrationId])
);

-- AddForeignKey
ALTER TABLE [dbo].[Registration] ADD CONSTRAINT [Registration_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[RegistrationCode] ADD CONSTRAINT [RegistrationCode_registrationId_fkey] FOREIGN KEY ([registrationId]) REFERENCES [dbo].[Registration]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
