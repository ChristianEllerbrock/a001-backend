BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[RegistrationNip46Code] (
    [id] NVARCHAR(1000) NOT NULL,
    [registrationId] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL,
    [validUntil] DATETIME2 NOT NULL,
    CONSTRAINT [RegistrationNip46Code_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [RegistrationNip46Code_registrationId_key] UNIQUE NONCLUSTERED ([registrationId])
);

-- AddForeignKey
ALTER TABLE [dbo].[RegistrationNip46Code] ADD CONSTRAINT [RegistrationNip46Code_registrationId_fkey] FOREIGN KEY ([registrationId]) REFERENCES [dbo].[Registration]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
