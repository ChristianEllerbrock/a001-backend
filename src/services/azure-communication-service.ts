import { CommunicationServiceManagementClient } from "@azure/arm-communication";
import { DefaultAzureCredential } from "@azure/identity";
import { EnvService } from "./env-service";

export class AzureCommunicationService {
    // #region Singleton

    static #instance: AzureCommunicationService;
    static get instance() {
        if (!this.#instance) {
            this.#instance = new AzureCommunicationService();
        }

        return this.#instance;
    }

    // #endregion Singleton

    #client: CommunicationServiceManagementClient;

    constructor() {
        const azureCredential = new DefaultAzureCredential();
        const subscriptionId =
            EnvService.instance.env.COMMUNICATION_SERVICES_SUBSCRIPTION_ID;

        this.#client = new CommunicationServiceManagementClient(
            azureCredential,
            subscriptionId
        );
    }

    async addEmail(email: string) {
        const resourceGroupName =
            EnvService.instance.env.COMMUNICATION_SERVICES_RESOURCE_GROUP_NAME;
        const emailServiceName =
            EnvService.instance.env.COMMUNICATION_SERVICES_EMAIL_SERVICE_NAME;

        const domainName = email.split("@")[1].toLowerCase();
        const username = email.split("@")[0].toLowerCase();

        const parameters = {
            displayName: "",
            username,
        };

        await this.#client.senderUsernames.createOrUpdate(
            resourceGroupName,
            emailServiceName,
            domainName,
            username,
            parameters
        );
    }
}

