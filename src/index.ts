import "reflect-metadata";

import "./extensions";
import "websocket-polyfill";
import express, { Express } from "express";
import dotenv from "dotenv";
import cors from "cors";
import { EnvService } from "./services/env-service";
import { graphqlHTTP } from "express-graphql";
import { getGraphqlContext } from "./graphql/type-defs";
import { buildSchema } from "type-graphql";
import { schemaOptions } from "./graphql/schema";
import { wellKnownNostrController } from "./controllers/well-known-nostr-controller";
import { hexController } from "./controllers/hex-controller";
import { reportFraudController } from "./controllers/report-fraud-controller";
import { confirmFraudController } from "./controllers/confirm-fraud-controller";
import { wellKnownLightningController } from "./controllers/well-known-lightning-controller";
import { testController } from "./controllers/test-controller";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";
import { Context as WsContext } from "graphql-ws";
import { emailController } from "./controllers/email/email-controller";
var path = require("path");
import multer from "multer";
import { EmailOutboundService } from "./services/email-outbound-service";
import { adminUpdateEmailAboutController } from "./controllers/admin/update-email-about-controller";
import { emailOutKillRandomRelayController } from "./controllers/admin/email-out-kill-random-relay";

// Load any environmental variables from the local .env file
dotenv.config();

const GRAPHQL_ENDPOINT = "/graphql";
const WS_ENDPOINT = "/subscriptions";

const app: Express = express();
const port = EnvService.instance.env.PORT;

app.use(express.json());
app.use(cors());

app.set("views", path.join(__dirname, "views"));
app.engine("html", require("ejs").renderFile);

// API Controller routes
app.get("/.test", testController);
app.get("/.well-known/nostr.json", wellKnownNostrController);
app.get("/.well-known/lnurlp/:username", wellKnownLightningController);
app.get("/hex", hexController);
app.get("/", (req, res, next) => {
    let appUrl = "";
    // req.hostname could be:
    // www.nip05.social
    // nip05.social
    // dev.nip05.social
    // www.protonostr.com
    // protonostr.com
    // dev.protonostr.com
    // localhost
    // ...
    if (req.hostname.includes("wwww.")) {
        appUrl = `${req.protocol}://${req.hostname.replace("wwww.", "app.")}`;
    } else if (req.hostname.includes("dev.")) {
        appUrl = `${req.protocol}://${req.hostname.replace(
            "dev.",
            "dev.app."
        )}`;
    } else if (req.hostname.includes("localhost")) {
        res.send("You are on localhost. No forwarding to any app location.");
        return;
    } else {
        appUrl = `${req.protocol}://${"app." + req.hostname}`;
    }
    console.log(appUrl);

    res.redirect(appUrl);
});
app.get("/report-fraud/:userId/:fraudId", reportFraudController);
app.get("/confirm-fraud/:userId/:fraudId", confirmFraudController);
app.post(
    `/${EnvService.instance.env.EMAIL_ENDPOINT}/`,
    multer().any(),
    emailController
);
app.get(`/${EnvService.instance.env.EMAIL_ENDPOINT}/`, (req, res) => {
    res.json("OK");
});

// Admin controllers
app.get("/admin/update-email-about", adminUpdateEmailAboutController);
app.get(
    "/admin/email-out-kill-random-relay",
    emailOutKillRandomRelayController
);

async function bootstrap() {
    const schema = await buildSchema(schemaOptions);
    app.use(
        GRAPHQL_ENDPOINT,
        graphqlHTTP((req, res, graphQLParams) => {
            return {
                schema: schema,
                context: getGraphqlContext(req),
                graphiql: { headerEditorEnabled: true },
                pretty: true,
            };
        })
    );

    const server = app.listen(port, () => {
        console.log(`⚡️[server]: Running at http://localhost:${port}`);
        console.log(`⚡️[server]: GraphQL endpoint is '${GRAPHQL_ENDPOINT}'`);
        console.log(`⚡️[server]: WS endpoint is '${WS_ENDPOINT}'`);

        // Start the Web Socket Server on the same port
        const wsServer = new WebSocketServer({
            server,
            path: WS_ENDPOINT,
        });

        // https://github.com/enisdenjo/graphql-ws
        useServer(
            {
                schema,
                // On initial WS connect: Check and verify the user JWT and only setup the subscription with a valid token
                // onConnect: async (ctx: WsContext) => {
                //     const params =
                //         ctx.connectionParams as unknown as WebSocketConnectionParams;
                //     try {
                //         const decodedPayload =
                //             await AccessTokenService.instance.verifyAsync(
                //                 params.accessToken
                //             );
                //         console.log(
                //             `[ws-server] - ${new Date().toISOString()} - ${
                //                 decodedPayload.email
                //             } has opened an authenticated web socket connection.`
                //         );
                //     } catch (error) {
                //         (ctx.extra as WsContextExtra).socket.close(
                //             4401,
                //             "Unauthorized"
                //         ); // This will force the client to NOT reconnect
                //     }
                //     return true;
                // },
                // Every following subscription access will uses the initial JWT (from the "onConnect") in the connectionParams
                context: (ctx: WsContext) => {
                    return {
                        name: "Peter",
                    };
                    // return getGraphqlSubContext(
                    //     ctx.connectionParams as unknown as WebSocketConnectionParams
                    // );
                },
            },
            wsServer
        );
    });

    EmailOutboundService.instance.start();
}

bootstrap();

