/*
  Warnings:

  - A unique constraint covering the columns `[userId,deviceId]` on the table `UserToken` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `deviceId` to the `UserToken` table without a default value. This is not possible if the table is not empty.

*/
BEGIN TRY

BEGIN TRAN;

DELETE FROM [dbo].[UserToken];

-- DropIndex
ALTER TABLE [dbo].[UserToken] DROP CONSTRAINT [UserToken_userId_key];

-- AlterTable
ALTER TABLE [dbo].[UserToken] ADD [deviceId] NVARCHAR(1000) NOT NULL;

-- CreateIndex
ALTER TABLE [dbo].[UserToken] ADD CONSTRAINT [UserToken_userId_deviceId_key] UNIQUE NONCLUSTERED ([userId], [deviceId]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
