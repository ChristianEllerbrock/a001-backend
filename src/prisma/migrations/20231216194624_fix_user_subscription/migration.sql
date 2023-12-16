/*
  Warnings:

  - You are about to drop the column `expiresAt` on the `UserSubscriptionInvoice` table. All the data in the column will be lost.
  - Added the required column `expiredAt` to the `UserSubscriptionInvoice` table without a default value. This is not possible if the table is not empty.

*/
BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[UserSubscriptionInvoice] ALTER COLUMN [description] NVARCHAR(1000) NULL;
ALTER TABLE [dbo].[UserSubscriptionInvoice] DROP COLUMN [expiresAt];
ALTER TABLE [dbo].[UserSubscriptionInvoice] ADD [expiredAt] DATETIME2 NOT NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
