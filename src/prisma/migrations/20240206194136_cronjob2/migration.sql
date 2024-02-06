BEGIN TRY

BEGIN TRAN;

-- RedefineTables
BEGIN TRANSACTION;
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'CronJob'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_CronJob] (
    [id] INT NOT NULL IDENTITY(1,1),
    [typeId] INT NOT NULL,
    [lastRunAt] DATETIME2 NOT NULL,
    [lastRunDuration] INT,
    [lastRunSuccess] BIT,
    [lastRunResult] NVARCHAR(1000),
    CONSTRAINT [CronJob_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CronJob_typeId_key] UNIQUE NONCLUSTERED ([typeId])
);
SET IDENTITY_INSERT [dbo].[_prisma_new_CronJob] ON;
IF EXISTS(SELECT * FROM [dbo].[CronJob])
    EXEC('INSERT INTO [dbo].[_prisma_new_CronJob] ([id],[lastRunAt],[lastRunDuration],[lastRunResult],[lastRunSuccess],[typeId]) SELECT [id],[lastRunAt],[lastRunDuration],[lastRunResult],[lastRunSuccess],[typeId] FROM [dbo].[CronJob] WITH (holdlock tablockx)');
SET IDENTITY_INSERT [dbo].[_prisma_new_CronJob] OFF;
DROP TABLE [dbo].[CronJob];
EXEC SP_RENAME N'dbo._prisma_new_CronJob', N'CronJob';
COMMIT;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
