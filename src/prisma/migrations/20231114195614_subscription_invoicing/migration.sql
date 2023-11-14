BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[UserSubscription] (
    [id] INT NOT NULL IDENTITY(1,1),
    [userId] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL,
    [pending] BIT NOT NULL,
    [cancelled] BIT NOT NULL,
    [oldSubscriptionId] INT NOT NULL,
    [newSubscriptionId] INT NOT NULL,
    [newSubscriptionEnd] DATETIME2,
    CONSTRAINT [UserSubscription_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[UserSubscriptionInvoice] (
    [id] INT NOT NULL IDENTITY(1,1),
    [userSubscriptionId] INT NOT NULL,
    [createdAt] DATETIME2 NOT NULL,
    [amount] INT NOT NULL,
    [description] NVARCHAR(1000) NOT NULL,
    [expiresAt] DATETIME2 NOT NULL,
    [paymentHash] NVARCHAR(1000) NOT NULL,
    [paymentRequest] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [UserSubscriptionInvoice_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UserSubscriptionInvoice_userSubscriptionId_key] UNIQUE NONCLUSTERED ([userSubscriptionId]),
    CONSTRAINT [UserSubscriptionInvoice_paymentHash_key] UNIQUE NONCLUSTERED ([paymentHash])
);

-- CreateTable
CREATE TABLE [dbo].[UserSubscriptionInvoicePayment] (
    [id] INT NOT NULL IDENTITY(1,1),
    [userSubscriptionInvoiceId] INT NOT NULL,
    [settled] BIT,
    [settledAt] DATETIME2,
    CONSTRAINT [UserSubscriptionInvoicePayment_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UserSubscriptionInvoicePayment_userSubscriptionInvoiceId_key] UNIQUE NONCLUSTERED ([userSubscriptionInvoiceId])
);

-- AddForeignKey
ALTER TABLE [dbo].[UserSubscription] ADD CONSTRAINT [UserSubscription_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[UserSubscription] ADD CONSTRAINT [UserSubscription_oldSubscriptionId_fkey] FOREIGN KEY ([oldSubscriptionId]) REFERENCES [dbo].[Subscription]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[UserSubscription] ADD CONSTRAINT [UserSubscription_newSubscriptionId_fkey] FOREIGN KEY ([newSubscriptionId]) REFERENCES [dbo].[Subscription]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[UserSubscriptionInvoice] ADD CONSTRAINT [UserSubscriptionInvoice_userSubscriptionId_fkey] FOREIGN KEY ([userSubscriptionId]) REFERENCES [dbo].[UserSubscription]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[UserSubscriptionInvoicePayment] ADD CONSTRAINT [UserSubscriptionInvoicePayment_userSubscriptionInvoiceId_fkey] FOREIGN KEY ([userSubscriptionInvoiceId]) REFERENCES [dbo].[UserSubscriptionInvoice]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
