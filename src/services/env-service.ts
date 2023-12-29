/* eslint-disable no-console */
import dotenv from "dotenv";

dotenv.config();

export class EnvServiceEnv {
    private _optionalProperties = [
        "NODE_TLS_REJECT_UNAUTHORIZED",
        "SHADOW_DATABASE_URL",
    ];

    PORT!: string;

    NODE_TLS_REJECT_UNAUTHORIZED?: string;

    DATABASE_URL!: string;
    SHADOW_DATABASE_URL?: string;

    //BOT_PRIVKEY!: string;
    //APP_URL!: string;
    //DOMAIN!: string;
    SERVICE_BUS_CONNECTION_STRING!: string;
    SERVICE_BUS_DM_QUEUE!: string;

    KEYVAULT_URI!: string;
    EMAIL_ENDPOINT!: string;
    COMMUNICATION_SERVICES_CONNECTION_STRING!: string;
    COMMUNICATION_SERVICES_SUBSCRIPTION_ID!: string;
    COMMUNICATION_SERVICES_RESOURCE_GROUP_NAME!: string;
    COMMUNICATION_SERVICES_EMAIL_SERVICE_NAME!: string;
    API_ADMIN_KEY!: string;
    ALBY_ACCESS_TOKEN!: string;
    ENVIRONMENT!: "dev" | "pro";

    isOptional(property: string) {
        return this._optionalProperties.includes(property);
    }
}

export class EnvService {
    // #region Singleton

    private static _instance: EnvService;
    static get instance() {
        if (this._instance) {
            return this._instance;
        }

        this._instance = new EnvService();
        return this._instance;
    }

    // #endregion Singleton

    constructor() {
        this._buildEnv();
    }

    // #region Public Properties

    get env() {
        return this._env;
    }

    // #endregion Public Properties

    // #region Private Properties

    private _env!: EnvServiceEnv;

    // #endregion Private Properties

    // #region Private Methods

    private _buildEnv() {
        const env = new EnvServiceEnv();

        console.log("Trying to read the following required keys from ENV:");

        for (let key of Object.keys(env)) {
            if (key[0] === "_") {
                continue;
            }

            if (env.isOptional(key)) {
                continue;
            }

            console.log(" " + key);
        }

        for (let key of Object.keys(env)) {
            if (key[0] === "_") {
                continue;
            }

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

        this._env = env;
    }

    // #endregion Private Methods
}

