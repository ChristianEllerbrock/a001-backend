/* eslint-disable no-console */
import dotenv from "dotenv";

dotenv.config();

export class EnvServiceEnv {
    #optionalProperties = [
        "NODE_TLS_REJECT_UNAUTHORIZED",
        "SHADOW_DATABASE_URL",
        "RELAY_START",
    ];

    PORT!: string;

    NODE_TLS_REJECT_UNAUTHORIZED?: string;

    DATABASE_URL!: string;
    SHADOW_DATABASE_URL?: string;

    SERVICE_BUS_CONNECTION_STRING!: string;
    SERVICE_BUS_DM_QUEUE!: string;

    KEYVAULT_URI!: string;
    EMAIL_ENDPOINT!: string;
    EMAIL_ENDPOINT_V2!: string;

    COMMUNICATION_SERVICES_SUBSCRIPTION_ID!: string;
    COMMUNICATION_SERVICES_RESOURCE_GROUP_NAME!: string;
    COMMUNICATION_SERVICES_EMAIL_SERVICE_NAME!: string;

    COMMUNICATION_SERVICES_CONNECTION_STRING_NIP05SOCIAL!: string;
    COMMUNICATION_SERVICES_CONNECTION_STRING_NOSTRIDINFO!: string;
    COMMUNICATION_SERVICES_CONNECTION_STRING_NOSTRCOMCOM!: string;
    COMMUNICATION_SERVICES_CONNECTION_STRING_NIP05CLOUD!: string;
    COMMUNICATION_SERVICES_CONNECTION_STRING_UNITEDNOSTRCOM!: string;
    COMMUNICATION_SERVICES_CONNECTION_STRING_PROTONOSTRCOM!: string;

    API_ADMIN_KEY!: string;
    ALBY_ACCESS_TOKEN!: string;
    ENVIRONMENT!: "dev" | "pro";
    RELAY_URL!: string;
    RELAY_START?: string;

    isOptional(property: string) {
        return this.#optionalProperties.includes(property);
    }

    getOptionalKeys(): string[] {
        return this.#optionalProperties;
    }
}

export class EnvService {
    // #region Singleton

    static #instance: EnvService;
    static get instance() {
        if (this.#instance) {
            return this.#instance;
        }

        this.#instance = new EnvService();
        return this.#instance;
    }

    // #endregion Singleton

    constructor() {
        this._buildEnv();
    }

    // #region Public Properties

    get env() {
        return this.#env;
    }

    // #endregion Public Properties

    // #region Private Properties

    #env!: EnvServiceEnv;

    // #endregion Private Properties

    // #region Private Methods

    private _buildEnv() {
        const env = new EnvServiceEnv();

        console.log("Trying to read the following required keys from ENV:");

        for (let key of Object.keys(env)) {
            if (env.isOptional(key)) {
                continue;
            }

            console.log(" " + key);
        }

        for (let key of Object.keys(env)) {
            if (env.isOptional(key)) {
                continue;
            }

            if (typeof process.env[key] === "undefined") {
                throw new Error(
                    `Could not read required ENV key '${key}' from ENV.`
                );
            }
            (env as any)[key] = process.env[key];
        }

        console.log("Trying to read optional keys from ENV:");

        for (const key of env.getOptionalKeys()) {
            if (typeof process.env[key] !== "undefined") {
                (env as any)[key] = process.env[key];
                console.log(` ${key}`);
            }
        }

        this.#env = env;
    }

    // #endregion Private Methods
}

