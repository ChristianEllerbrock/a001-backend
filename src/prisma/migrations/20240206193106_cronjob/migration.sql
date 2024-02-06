BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[CronJob] (
    [id] INT NOT NULL,
    [typeId] INT NOT NULL,
    [lastRunAt] DATETIME2 NOT NULL,
    [lastRunDuration] INT,
    [lastRunSuccess] BIT,
    [lastRunResult] NVARCHAR(1000),
    CONSTRAINT [CronJob_pkey] PRIMARY KEY CLUSTERED ([id])
);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
