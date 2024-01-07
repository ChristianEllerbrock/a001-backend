BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[BotMetadata] (
    [id] INT NOT NULL IDENTITY(1,1),
    [createdAt] DATETIME2 NOT NULL,
    [nip05] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [about] NVARCHAR(1000),
    [picture] NVARCHAR(1000),
    [banner] NVARCHAR(1000),
    CONSTRAINT [BotMetadata_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[BotMetadataRelay] (
    [id] INT NOT NULL IDENTITY(1,1),
    [botMetadataId] INT NOT NULL,
    [publishedAt] DATETIME2 NOT NULL,
    [url] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [BotMetadataRelay_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- AddForeignKey
ALTER TABLE [dbo].[BotMetadataRelay] ADD CONSTRAINT [BotMetadataRelay_botMetadataId_fkey] FOREIGN KEY ([botMetadataId]) REFERENCES [dbo].[BotMetadata]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
