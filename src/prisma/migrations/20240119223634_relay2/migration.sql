/*
  Warnings:

  - You are about to drop the column `signature` on the `RelayEvent` table. All the data in the column will be lost.
  - Added the required column `sig` to the `RelayEvent` table without a default value. This is not possible if the table is not empty.

*/
BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[RelayEvent] DROP COLUMN [signature];
ALTER TABLE [dbo].[RelayEvent] ADD [sig] NVARCHAR(1000) NOT NULL;

-- CreateTable
CREATE TABLE [dbo].[RelayEventTag] (
    [id] INT NOT NULL IDENTITY(1,1),
    [relayEventId] NVARCHAR(1000) NOT NULL,
    [name] VARCHAR(1) NOT NULL,
    [value] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [RelayEventTag_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- AddForeignKey
ALTER TABLE [dbo].[RelayEventTag] ADD CONSTRAINT [RelayEventTag_relayEventId_fkey] FOREIGN KEY ([relayEventId]) REFERENCES [dbo].[RelayEvent]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
