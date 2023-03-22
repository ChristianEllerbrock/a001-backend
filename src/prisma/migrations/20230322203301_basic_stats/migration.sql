BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[DailyLookup] (
    [id] INT NOT NULL IDENTITY(1,1),
    [date] DATETIME2 NOT NULL,
    [nipped] INT NOT NULL,
    CONSTRAINT [DailyLookup_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[StatUser] (
    [id] INT NOT NULL IDENTITY(1,1),
    [date] DATETIME2 NOT NULL,
    [users] INT NOT NULL,
    CONSTRAINT [StatUser_pkey] PRIMARY KEY CLUSTERED ([id])
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
