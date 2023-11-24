/*
  Warnings:

  - You are about to drop the `RegistrationEmailForwarding` table. If the table is not empty, all the data it contains will be lost.

*/
BEGIN TRY

BEGIN TRAN;

-- DropForeignKey
ALTER TABLE [dbo].[RegistrationEmailForwarding] DROP CONSTRAINT [RegistrationEmailForwarding_registrationId_fkey];

-- DropTable
DROP TABLE [dbo].[RegistrationEmailForwarding];

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
