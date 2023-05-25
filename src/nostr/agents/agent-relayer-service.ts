import { AzureSecretService } from "../../services/azure-secret-service";
import { Agent } from "./agent";
import { AgentRelayer, AgentRelayerSendAsyncResponse } from "./agent-relayer";

export class AgentRelayerService {
    // #region Singleton

    private static _instance: AgentRelayerService;
    static get instance() {
        if (!this._instance) {
            this._instance = new AgentRelayerService();
        }

        return this._instance;
    }

    // #endregion Singleton

    constructor() {}

    // #region Private Properties

    private _ar: AgentRelayer | undefined;
    private _relays = [
        "wss://relay.damus.io",
        "wss://nos.lol",
        "wss://relay.snort.social",
        "wss://nostr1.current.fyi",
        "wss://nostr-pub.wellorder.net",
        "wss://relay.nostr.bg",
        "wss://no.str.cr", // cannot connect
        "wss://nostr.mom",
        "wss://relay.plebstr.com",
        "wss://offchain.pub",
        "wss://nostr.bitcoiner.social",
        "wss://spore.ws",
        "wss://nostr21.com",
    ];

    private _agents: Agent[] | undefined;

    // #endregion Private Properties

    // #region Public Methods

    async sendAsync(
        toPubkey: string,
        content: string
    ): Promise<AgentRelayerSendAsyncResponse | undefined> {
        await this._init();

        return this._ar?.sendAsync(toPubkey, content);
    }

    async init() {
        await this._init();
    }

    async initWithCustomRelayer(relays: string[]): Promise<AgentRelayer> {
        return await this._initWithCustomRelayer(relays);
    }

    getSendEvent() {
        return this._ar?.sendEvent;
    }

    getAgentRelayer() {
        return this._ar;
    }

    async send(toPubkey: string, content: string, jobId: string) {
        await this._init();

        if (!this._ar) {
            return;
        }
        await this._ar.send(toPubkey, content, jobId);
    }

    async sendWithCustomRelayer(
        toPubkey: string,
        content: string,
        jobId: string,
        ar: AgentRelayer
    ) {
        await ar.send(toPubkey, content, jobId);
    }

    close() {
        this._ar?.close();
    }

    // #endregion Public Methods

    // #region Private Methods

    private async _init() {
        if (this._ar) {
            return; // already initialized
        }

        // Retrieve agent list from Azure key vault.
        const agents = await AzureSecretService.instance.tryGetValue<Agent[]>(
            "agents"
        );
        if (typeof agents === "undefined") {
            throw new Error(
                "Unable to retrieve agent list from Azure Key Vault."
            );
        }

        this._agents = agents;

        this._ar = new AgentRelayer(agents[0], this._relays, {
            debug: true,
            sendTimeoutInMs: 15000,
        });
    }

    private async _initWithCustomRelayer(relays: string[]) {
        if (typeof this._agents === "undefined") {
            const agents = await AzureSecretService.instance.tryGetValue<
                Agent[]
            >("agents");
            if (typeof agents === "undefined") {
                throw new Error(
                    "Unable to retrieve agent list from Azure Key Vault."
                );
            }
            this._agents = agents;
        }

        return new AgentRelayer(this._agents[1], relays, {
            debug: true,
            sendTimeoutInMs: 15000,
        });
    }

    // #endregion Private Methods
}

