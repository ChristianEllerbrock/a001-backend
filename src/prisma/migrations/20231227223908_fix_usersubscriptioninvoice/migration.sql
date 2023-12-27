/*
  Warnings:

  - You are about to drop the column `expiredAt` on the `UserSubscriptionInvoice` table. All the data in the column will be lost.
  - Added the required column `expiresAt` to the `UserSubscriptionInvoice` table without a default value. This is not possible if the table is not empty.

*/
BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[UserSubscriptionInvoice] DROP COLUMN [expiredAt];
ALTER TABLE [dbo].[UserSubscriptionInvoice] ADD [expiresAt] DATETIME2 NOT NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
