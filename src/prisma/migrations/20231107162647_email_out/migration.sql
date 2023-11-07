BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[RegistrationEmailOut] (
    [id] INT NOT NULL IDENTITY(1,1),
    [registrationId] NVARCHAR(1000) NOT NULL,
    [date] DATETIME2 NOT NULL,
    [total] INT NOT NULL,
    CONSTRAINT [RegistrationEmailOut_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [RegistrationEmailOut_registrationId_date_key] UNIQUE NONCLUSTERED ([registrationId],[date])
);

-- CreateTable
CREATE TABLE [dbo].[EmailNostrDm] (
    [id] INT NOT NULL IDENTITY(1,1),
    [emailNostrId] INT NOT NULL,
    [eventId] NVARCHAR(1000) NOT NULL,
    [eventCreatedAt] INT NOT NULL,
    [sent] DATETIME2,
    CONSTRAINT [EmailNostrDm_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- AddForeignKey
ALTER TABLE [dbo].[RegistrationEmailOut] ADD CONSTRAINT [RegistrationEmailOut_registrationId_fkey] FOREIGN KEY ([registrationId]) REFERENCES [dbo].[Registration]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[EmailNostrDm] ADD CONSTRAINT [EmailNostrDm_emailNostrId_fkey] FOREIGN KEY ([emailNostrId]) REFERENCES [dbo].[EmailNostr]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
