BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[Registration] ADD [systemDomainId] INT NOT NULL CONSTRAINT [Registration_systemDomainId_df] DEFAULT 1;

-- AddForeignKey
ALTER TABLE [dbo].[Registration] ADD CONSTRAINT [Registration_systemDomainId_fkey] FOREIGN KEY ([systemDomainId]) REFERENCES [dbo].[SystemDomain]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
