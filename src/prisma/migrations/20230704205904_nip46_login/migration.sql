BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[UserLoginNip07Code] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [deviceId] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL,
    [validUntil] DATETIME2 NOT NULL,
    CONSTRAINT [UserLoginNip07Code_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UserLoginNip07Code_userId_deviceId_key] UNIQUE NONCLUSTERED ([userId],[deviceId])
);

-- CreateTable
CREATE TABLE [dbo].[UserLoginNip46Code] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [deviceId] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL,
    [validUntil] DATETIME2 NOT NULL,
    CONSTRAINT [UserLoginNip46Code_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UserLoginNip46Code_userId_deviceId_key] UNIQUE NONCLUSTERED ([userId],[deviceId])
);

-- AddForeignKey
ALTER TABLE [dbo].[UserLoginNip07Code] ADD CONSTRAINT [UserLoginNip07Code_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[UserLoginNip46Code] ADD CONSTRAINT [UserLoginNip46Code_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
