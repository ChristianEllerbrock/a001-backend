BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[RelayConnection] ADD [uptimeInSeconds] INT;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
