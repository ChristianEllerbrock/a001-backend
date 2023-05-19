BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[JobState] (
    [id] INT NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [JobState_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[JobType] (
    [id] INT NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [JobType_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Job] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Job_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [finishedAt] DATETIME2,
    [finishedOk] BIT,
    [message] NVARCHAR(1000),
    [durationInSeconds] INT,
    [jobStateId] INT NOT NULL,
    [jobTypeId] INT NOT NULL,
    CONSTRAINT [Job_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- AddForeignKey
ALTER TABLE [dbo].[Job] ADD CONSTRAINT [Job_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Job] ADD CONSTRAINT [Job_jobStateId_fkey] FOREIGN KEY ([jobStateId]) REFERENCES [dbo].[JobState]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Job] ADD CONSTRAINT [Job_jobTypeId_fkey] FOREIGN KEY ([jobTypeId]) REFERENCES [dbo].[JobType]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
