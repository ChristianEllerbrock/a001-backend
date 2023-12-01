BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[Registration] ADD [emailOut] BIT NOT NULL CONSTRAINT [Registration_emailOut_df] DEFAULT 0,
[emailOutSubject] NVARCHAR(1000) NOT NULL CONSTRAINT [Registration_emailOutSubject_df] DEFAULT 'Nostr 2 Email';

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
