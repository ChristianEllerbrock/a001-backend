/*
  Warnings:

  - You are about to drop the `UserRelay` table. If the table is not empty, all the data it contains will be lost.

*/
BEGIN TRY

BEGIN TRAN;

-- DropForeignKey
ALTER TABLE [dbo].[UserRelay] DROP CONSTRAINT [UserRelay_userId_fkey];

-- DropTable
DROP TABLE [dbo].[UserRelay];

-- CreateTable
CREATE TABLE [dbo].[RegistrationRelay] (
    [id] NVARCHAR(1000) NOT NULL,
    [registrationId] NVARCHAR(1000) NOT NULL,
    [address] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [RegistrationRelay_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- AddForeignKey
ALTER TABLE [dbo].[RegistrationRelay] ADD CONSTRAINT [RegistrationRelay_registrationId_fkey] FOREIGN KEY ([registrationId]) REFERENCES [dbo].[Registration]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
