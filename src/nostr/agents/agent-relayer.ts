import { Subject } from "rxjs";
import { NostrEvent, NostrEventKind } from "../nostr";
import { NostrHelperV2 } from "../nostr-helper-2";
import { Agent } from "./agent";
import { RelayClient } from "./relay-client";

export type AgentArrayConfig = {
    // todo
};

export type AgentRelayerSendAsyncResponse = {
    okRelays: string[];
    failedRelays: string[];
};

export type AgentRelayerConfig = {
    debug: boolean;
    sendTimeoutInMs: number;
};

export type AgentRelayerSendEvent = {
    jobId: string;
    relay: string;
    success: boolean;
    message?: string;
};

export class AgentRelayer {
    // #region Public Properties

    get sendEvent() {
        return this._sendEvent;
    }

    get relayClients() {
        return this._relayClients;
    }

    // #endregion Public Properties

    // #region Private Properties

    private _relayClients: RelayClient[] = [];
    private _agent: Agent;
    private _config: AgentRelayerConfig;
    private _sendEvent = new Subject<AgentRelayerSendEvent>();

    // #endregion Private Properties

    // #region Constructor

    constructor(
        agent: Agent,
        relays: string[],
        config: AgentRelayerConfig | undefined = undefined
    ) {
        // Make sure that we only have unique relays.
        const uniqueRelays = Array.from(new Set<string>(relays));

        if (config) {
            this._config = config;
        } else {
            this._config = {
                debug: false,
                sendTimeoutInMs: 10000,
            };
        }

        for (let relay of uniqueRelays) {
            this._relayClients.push(new RelayClient(relay, this._config));
        }

        this._agent = agent;
    }

    // #endregion Constructor

    // #region Public Methods

    sendAsync(
        toPubkey: string,
        content: string
    ): Promise<AgentRelayerSendAsyncResponse> {
        let ok = 0;
        let failed = 0;
        const all = this._relayClients.length;

        const response: AgentRelayerSendAsyncResponse = {
            okRelays: [],
            failedRelays: [],
        };

        return new Promise<AgentRelayerSendAsyncResponse>(
            async (resolve, reject) => {
                // Create encrypted content
                const encryptedContent =
                    await NostrHelperV2.encryptDirectMessage(
                        this._agent.privkey,
                        toPubkey,
                        content
                    );

                const event = NostrHelperV2.createEvent({
                    privkey: this._agent.privkey,
                    data: {
                        kind: NostrEventKind.EncryptedDirectMessage,
                        pubkey: this._agent.pubkey,
                        created_at: NostrHelperV2.getCreatedAt(),
                        content: encryptedContent,
                        tags: [["p", toPubkey]],
                    },
                });

                for (let relayClient of this._relayClients) {
                    relayClient
                        .send(event)
                        .then((x) => {
                            ok++;
                            response.okRelays.push(relayClient.relay);
                            if (ok + failed === all) {
                                resolve(response);
                                return;
                            }
                        })
                        .catch((error) => {
                            failed++;
                            response.failedRelays.push(relayClient.relay);
                            if (ok + failed === all) {
                                resolve(response);
                                return;
                            }
                        });
                }
            }
        );
    }

    async send(toPubkey: string, content: string, jobId: string) {
        //
        const encryptedContent = await NostrHelperV2.encryptDirectMessage(
            this._agent.privkey,
            toPubkey,
            content
        );

        const event = NostrHelperV2.createEvent({
            privkey: this._agent.privkey,
            data: {
                kind: NostrEventKind.EncryptedDirectMessage,
                pubkey: this._agent.pubkey,
                created_at: NostrHelperV2.getCreatedAt(),
                content: encryptedContent,
                tags: [["p", toPubkey]],
            },
        });

        for (let relayClient of this._relayClients) {
            relayClient
                .send(event)
                .then((x) => {
                    this._sendEvent.next({
                        jobId,
                        relay: relayClient.relay,
                        success: true,
                    });
                    return;
                })
                .catch((error) => {
                    this._sendEvent.next({
                        jobId,
                        relay: relayClient.relay,
                        success: false,
                    });
                });
        }
    }

    close() {
        for (let relayClient of this._relayClients) {
            relayClient.close();
        }
    }

    // #endregion Public Methods
}

