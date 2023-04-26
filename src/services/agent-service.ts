class Agent {
    pubkey: string;
    identifier: string;

    constructor(pubkey: string, identifier: string) {
        this.pubkey = pubkey;
        this.identifier = identifier;
    }
}

export class AgentService {
    // #region Singleton

    private static _instance: AgentService;
    static get instance() {
        if (this._instance) {
            return this._instance;
        }

        this._instance = new AgentService();
        return this._instance;
    }

    // #endregion Singleton

    // #region Constructor

    constructor() {
        this._bots = [
            new Agent(
                "decfe634a6a6a6025fb59d4e139026381242b9ddad6b8d612d370c343942c005",
                "bot"
            ),
            new Agent(
                "c6d5eb25e5b352ba8e0e5bf5e70f79d6f18492d1fc294554a53996d4755221ef",
                "bot2"
            ),
            new Agent(
                "4b1ef958fe009df0c696b7443034c9d4f4e15b9948553e86693b43e689449961",
                "bot3"
            ),
            new Agent(
                "b96fc93681c73f2477a67bf462025d6b6f843db2aaea2b410f8e593316bfa92a",
                "bot4"
            ),
            new Agent(
                "50b61ee8f15860252a3835fd949a11b1ce5b01bb352d53b7e5437f130c178984",
                "bot5"
            ),
            new Agent(
                "f975acbafed19f190ec608c800dcd2acf4d2b376cdc144582cf51ca728a219c5",
                "bot6"
            ),
            new Agent(
                "d1f76005694e26ba955370ca74d86defe2862564c3eea79a7414d9a5fa30a9f4",
                "bot7"
            ),
            new Agent(
                "2b95e398f5c20509605639300c7a52252f77380e9d3268230bf0b49a277a0a87",
                "bot8"
            ),
            new Agent(
                "1e4ab9bf9395959dca9a52dfdfa83e38f74aa0153ece44163e3e4c71e9c81fcc",
                "bot9"
            ),
            new Agent(
                "8377ae5e4c818aa4e429a08f009d64295d43057bd90a5325137051602a432ef7",
                "bot10"
            ),
        ];
    }

    // #endregion Constructor

    // #region Private Properties

    private _bots: Agent[] = [];

    // #endregion Private Properties

    // #region Public Methods

    async determineAgentInfoForNextJobAsync(
        relay: string
    ): Promise<[string, string]> {
        // TODO: implement logic to pick best sessionId
        // For now: always go with bot1

        const botPubkey = this._bots[0].pubkey;
        const sessionId = botPubkey + relay.toLowerCase();

        return [botPubkey, sessionId];
    }

    // #endregion Public Methods
}

