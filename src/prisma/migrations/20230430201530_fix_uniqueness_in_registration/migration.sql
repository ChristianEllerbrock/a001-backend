/*
  Warnings:

  - A unique constraint covering the columns `[identifier,systemDomainId]` on the table `Registration` will be added. If there are existing duplicate values, this will fail.

*/
BEGIN TRY

BEGIN TRAN;

-- DropIndex
ALTER TABLE [dbo].[Registration] DROP CONSTRAINT [Registration_identifier_key];

-- CreateIndex
ALTER TABLE [dbo].[Registration] ADD CONSTRAINT [Registration_identifier_systemDomainId_key] UNIQUE NONCLUSTERED ([identifier], [systemDomainId]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
