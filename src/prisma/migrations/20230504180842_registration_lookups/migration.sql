BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[RegistrationLookup] (
    [id] INT NOT NULL IDENTITY(1,1),
    [registrationId] NVARCHAR(1000) NOT NULL,
    [date] DATETIME2 NOT NULL,
    [total] INT NOT NULL,
    CONSTRAINT [RegistrationLookup_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- AddForeignKey
ALTER TABLE [dbo].[RegistrationLookup] ADD CONSTRAINT [RegistrationLookup_registrationId_fkey] FOREIGN KEY ([registrationId]) REFERENCES [dbo].[Registration]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
