BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[NostrEvent] (
    [id] NVARCHAR(1000) NOT NULL,
    [pubkey] NVARCHAR(1000) NOT NULL,
    [createdAt] INT NOT NULL,
    [kind] INT NOT NULL,
    [value] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [NostrEvent_pkey] PRIMARY KEY CLUSTERED ([id])
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
