import { DefaultAzureCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";
import { EnvService } from "./env-service";

export class AzureSecretService {
    // #region Singleton

    private static _instance: AzureSecretService;
    static get instance() {
        if (!this._instance) {
            this._instance = new AzureSecretService();
        }

        return this._instance;
    }

    // #endregion Singleton

    // #region Private Properties

    private _client: SecretClient;

    // #endregion Private Properties

    // #region Constructor

    constructor() {
        const azureCredential = new DefaultAzureCredential();
        this._client = new SecretClient(
            EnvService.instance.env.KEYVAULT_URI,
            azureCredential
        );
    }

    // #endregion Constructor

    // #region Public Methods

    async tryGetValue<T>(secretName: string): Promise<T | undefined> {
        const secret = await this._client.getSecret(secretName);
        if (!secret.value) {
            return undefined;
        }

        const value = JSON.parse(secret.value) as T;
        return value;
    }

    // #endregion Public Methods
}

