/*
  Warnings:

  - Added the required column `qrCodePng` to the `UserSubscriptionInvoice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `qrCodeSvg` to the `UserSubscriptionInvoice` table without a default value. This is not possible if the table is not empty.

*/
BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[UserSubscriptionInvoice] ADD [qrCodePng] NVARCHAR(1000) NOT NULL,
[qrCodeSvg] NVARCHAR(1000) NOT NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
