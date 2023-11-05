BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[User] ADD [subscriptionEnd] DATETIME2,
[subscriptionId] INT NOT NULL CONSTRAINT [User_subscriptionId_df] DEFAULT 1;

-- AddForeignKey
ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_subscriptionId_fkey] FOREIGN KEY ([subscriptionId]) REFERENCES [dbo].[Subscription]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
