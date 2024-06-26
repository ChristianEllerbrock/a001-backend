import { PrismaClient, SystemConfig } from "@prisma/client";
import { SystemConfigId } from "../prisma/assortments";

export class PrismaService {
    // #region Singleton

    private static _instance: PrismaService;
    static get instance() {
        if (this._instance) {
            return this._instance;
        }

        this._instance = new PrismaService();
        return this._instance;
    }

    constructor() {
        this._db = new PrismaClient();
    }

    // #endregion Singleton

    // #region Public Properties

    get db() {
        return this._db;
    }

    // #endregion Public Properties

    // #region Private Properties

    private _db: PrismaClient;
    private _systemConfig: SystemConfig[] | undefined;

    // #endregion Private Properties

    // #region Public Methods

    async getSystemConfigAsync(
        id: SystemConfigId
    ): Promise<string | undefined> {
        if (typeof this._systemConfig === "undefined") {
            this._systemConfig = await this._db.systemConfig.findMany({});
        }

        return this._systemConfig.find((x) => x.id === id)?.value;
    }

    async getSystemConfigAsNumberAsync(
        id: SystemConfigId
    ): Promise<number | undefined> {
        const configValueAsString = await this.getSystemConfigAsync(id);
        if (!configValueAsString) {
            return undefined;
        }

        const configValueAsNumber = Number.parseInt(configValueAsString);
        return Number.isNaN(configValueAsNumber)
            ? undefined
            : configValueAsNumber;
    }

    // #endregion Private Methods
}

