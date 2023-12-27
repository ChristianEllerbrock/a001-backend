BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[UserSubscription] ADD [expirationReminder1] DATETIME2,
[expirationReminder14] DATETIME2,
[expirationReminder3] DATETIME2,
[expirationReminder7] DATETIME2;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
