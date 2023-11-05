BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[Subscription] (
    [id] INT NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [satsPerMonth] INT NOT NULL,
    [maxNoOfNostrAddresses] INT NOT NULL,
    [maxNoOfInboundEmailsPerMOnth] INT NOT NULL,
    [maxNoOfOutboundEmailsPerMonth] INT NOT NULL,
    CONSTRAINT [Subscription_pkey] PRIMARY KEY CLUSTERED ([id])
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
