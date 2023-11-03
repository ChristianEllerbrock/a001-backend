import { DefaultAzureCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";
import { EnvService } from "./env-service";

export class AzureSecretService {
    // #region Singleton

    static #instance: AzureSecretService;
    static get instance() {
        if (!this.#instance) {
            this.#instance = new AzureSecretService();
        }

        return this.#instance;
    }

    // #endregion Singleton

    // #region Private Properties

    #client: SecretClient;

    // #endregion Private Properties

    // #region Constructor

    constructor() {
        const azureCredential = new DefaultAzureCredential();
        this.#client = new SecretClient(
            EnvService.instance.env.KEYVAULT_URI,
            azureCredential
        );
    }

    // #endregion Constructor

    // #region Public Methods

    async tryGetValue<T>(secretName: string): Promise<T | undefined> {
        const secret = await this.#client.getSecret(secretName);
        if (!secret.value) {
            return undefined;
        }

        const value = JSON.parse(secret.value) as T;
        return value;
    }

    async trySetValue<T>(secretName: string, value: T): Promise<boolean> {
        const secret = await this.#client.setSecret(
            secretName,
            JSON.stringify(value)
        );

        if (!secret.value) {
            return false;
        }
        return true;
    }

    // #endregion Public Methods
}

