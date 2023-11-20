BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[SystemUser] (
    [id] INT NOT NULL,
    [pubkey] NVARCHAR(1000) NOT NULL,
    [keyvaultKey] NVARCHAR(1000) NOT NULL,
    [nip05] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000),
    [about] NVARCHAR(1000),
    [picture] NVARCHAR(1000),
    [banner] NVARCHAR(1000),
    [lookups] INT NOT NULL,
    [lastLookupDate] DATETIME2,
    CONSTRAINT [SystemUser_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[SystemUserRelay] (
    [id] INT NOT NULL,
    [systemUserId] INT NOT NULL,
    [url] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [SystemUserRelay_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- AddForeignKey
ALTER TABLE [dbo].[SystemUserRelay] ADD CONSTRAINT [SystemUserRelay_systemUserId_fkey] FOREIGN KEY ([systemUserId]) REFERENCES [dbo].[SystemUser]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
