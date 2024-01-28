/*
  Warnings:

  - A unique constraint covering the columns `[date]` on the table `RelayStat` will be added. If there are existing duplicate values, this will fail.

*/
BEGIN TRY

BEGIN TRAN;

-- CreateIndex
ALTER TABLE [dbo].[RelayStat] ADD CONSTRAINT [RelayStat_date_key] UNIQUE NONCLUSTERED ([date]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
