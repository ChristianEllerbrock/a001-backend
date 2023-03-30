import { ServiceBusClient, ServiceBusMessage } from "@azure/service-bus";
import { EnvService } from "./env-service";

export class AzureServiceBus {
    // #region Singleton

    private static _instance: AzureServiceBus;
    static get instance() {
        if (this._instance) {
            return this._instance;
        }

        this._instance = new AzureServiceBus();
        return this._instance;
    }

    // #endregion Singleton

    // #region Private Properties

    private _client: ServiceBusClient;

    // #endregion Private Properties

    constructor() {
        this._client = new ServiceBusClient(
            EnvService.instance.env.SERVICE_BUS_CONNECTION_STRING
        );
    }

    async sendAsync(message: ServiceBusMessage, queueName: string) {
        const sender = this._client.createSender(queueName);

        await sender.sendMessages(message);
    }
}

