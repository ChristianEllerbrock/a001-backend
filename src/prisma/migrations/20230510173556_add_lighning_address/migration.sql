BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[Registration] ADD [lightningAddress] NVARCHAR(1000);

-- CreateTable
CREATE TABLE [dbo].[LightningAddressLookup] (
    [id] INT NOT NULL IDENTITY(1,1),
    [registrationId] NVARCHAR(1000) NOT NULL,
    [date] DATETIME2 NOT NULL,
    [total] INT NOT NULL,
    CONSTRAINT [LightningAddressLookup_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- AddForeignKey
ALTER TABLE [dbo].[LightningAddressLookup] ADD CONSTRAINT [LightningAddressLookup_registrationId_fkey] FOREIGN KEY ([registrationId]) REFERENCES [dbo].[Registration]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
