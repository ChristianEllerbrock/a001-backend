import { NextFunction, Request, Response } from "express";
import { AgentRelayerService } from "../nostr/agents/agent-relayer-service";
import { NostrHelperV2 } from "../nostr/nostr-helper-2";
import { DateTime } from "luxon";
import { v4 } from "uuid";
import { uniqueNamesGenerator, Config, starWars } from "unique-names-generator";

export async function testController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        // const start = DateTime.now();
        // const response = await AgentRelayerService.instance.sendAsync(
        //     "090e4e48e07e331b7a9eb527532794969ab1086ddfa4d805fff88c6358e9d15d",
        //     `Hallo ${new Date().toISOString()}`
        // );
        // const duration = DateTime.now()
        //     .diff(start, "seconds")
        //     .toObject().seconds;

        // const result = {
        //     duration,
        //     response,
        // };

        // AgentRelayerService.instance.close();

        // res.json(result);

        const config: Config = {
            dictionaries: [starWars],
        };

        await AgentRelayerService.instance.init();
        const ar = AgentRelayerService.instance.getAgentRelayer();
        const event = AgentRelayerService.instance.getSendEvent();

        const noOfRelays = ar?.relayClients.length ?? 0;
        let relayResponses = 0;

        const jobId = v4();
        const subscription = event?.subscribe((sendEvent) => {
            console.log(sendEvent);
            if (sendEvent.jobId !== jobId) {
                return; // from some other request
            }
            relayResponses++;
            if (relayResponses === noOfRelays) {
                console.log("END");
                subscription?.unsubscribe();
            }
        });

        // Kill subscription after timeout (just to be sure)
        // setTimeout(() => {
        //     subscription?.unsubscribe();
        //     console.log("Subscription killed after timeout.");
        // }, 15000);

        const characterName: string = uniqueNamesGenerator(config);

        await AgentRelayerService.instance.send(
            "090e4e48e07e331b7a9eb527532794969ab1086ddfa4d805fff88c6358e9d15d",
            characterName,
            jobId
        );
        res.json(characterName);
    } catch (error) {
        next(error);
    }
}

