BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[RegistrationEmailIn] (
    [id] INT NOT NULL IDENTITY(1,1),
    [registrationId] NVARCHAR(1000) NOT NULL,
    [date] DATETIME2 NOT NULL,
    [total] INT NOT NULL,
    CONSTRAINT [RegistrationEmailIn_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [RegistrationEmailIn_registrationId_date_key] UNIQUE NONCLUSTERED ([registrationId],[date])
);

-- AddForeignKey
ALTER TABLE [dbo].[RegistrationEmailIn] ADD CONSTRAINT [RegistrationEmailIn_registrationId_fkey] FOREIGN KEY ([registrationId]) REFERENCES [dbo].[Registration]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

INSERT into [dbo].[RegistrationEmailIn] 
SELECT registrationId, [date], total from [dbo].[RegistrationEmailForwarding]

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
