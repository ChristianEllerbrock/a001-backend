BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[RegistrationNip07Code] (
    [id] NVARCHAR(1000) NOT NULL,
    [registrationId] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL,
    [validUntil] DATETIME2 NOT NULL,
    CONSTRAINT [RegistrationNip07Code_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [RegistrationNip07Code_registrationId_key] UNIQUE NONCLUSTERED ([registrationId])
);

-- AddForeignKey
ALTER TABLE [dbo].[RegistrationNip07Code] ADD CONSTRAINT [RegistrationNip07Code_registrationId_fkey] FOREIGN KEY ([registrationId]) REFERENCES [dbo].[Registration]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
