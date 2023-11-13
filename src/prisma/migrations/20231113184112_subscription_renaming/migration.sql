/*
  Warnings:

  - You are about to drop the column `maxNoOfInboundEmailsPerMOnth` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `maxNoOfOutboundEmailsPerMonth` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `satsPerMonth` on the `Subscription` table. All the data in the column will be lost.
  - Added the required column `maxNoOfInboundEmailsPer30Days` to the `Subscription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `maxNoOfOutboundEmailsPer30Days` to the `Subscription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `satsPer30Days` to the `Subscription` table without a default value. This is not possible if the table is not empty.

*/
BEGIN TRY

BEGIN TRAN;

-- AlterTable
EXEC sp_rename '[dbo].[Subscription].[maxNoOfInboundEmailsPerMOnth]', 'maxNoOfInboundEmailsPer30Days', 'COLUMN';
EXEC sp_rename '[dbo].[Subscription].[maxNoOfOutboundEmailsPerMonth]', 'maxNoOfOutboundEmailsPer30Days', 'COLUMN';
EXEC sp_rename '[dbo].[Subscription].[satsPerMonth]', 'satsPer30Days', 'COLUMN';


-- ALTER TABLE [dbo].[Subscription] RENAME COLUMN "maxNoOfInboundEmailsPerMOnth" TO "maxNoOfInboundEmailsPer30Days";
-- ALTER TABLE [dbo].[Subscription] RENAME COLUMN "maxNoOfOutboundEmailsPerMonth" TO "maxNoOfOutboundEmailsPer30Days";
-- ALTER TABLE [dbo].[Subscription] RENAME COLUMN "satsPerMonth" TO "satsPer30Days";

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
