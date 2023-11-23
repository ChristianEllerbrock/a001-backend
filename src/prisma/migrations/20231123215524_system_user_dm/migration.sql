BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[SystemUserDm] (
    [id] INT NOT NULL IDENTITY(1,1),
    [systemUserId] INT NOT NULL,
    [eventId] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [SystemUserDm_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SystemUserDm_eventId_key] UNIQUE NONCLUSTERED ([eventId])
);

-- AddForeignKey
ALTER TABLE [dbo].[SystemUserDm] ADD CONSTRAINT [SystemUserDm_systemUserId_fkey] FOREIGN KEY ([systemUserId]) REFERENCES [dbo].[SystemUser]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
