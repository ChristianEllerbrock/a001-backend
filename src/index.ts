import "reflect-metadata";

import "./extensions";
import "websocket-polyfill";
import express, { Express } from "express";
import { createHandler } from "graphql-http/lib/use/express";
import dotenv from "dotenv";
import cors from "cors";
import { EnvService } from "./services/env-service";
import { getGraphqlContext2 } from "./graphql/type-defs";
import { buildSchema } from "type-graphql";
import { schemaOptions } from "./graphql/schema";
import { wellKnownNostrController } from "./controllers/well-known-nostr-controller";
import { hexController } from "./controllers/hex-controller";
import { wellKnownLightningController } from "./controllers/well-known-lightning-controller";
import { testController } from "./controllers/test-controller";
import { WebSocketServer } from "ws";
import { emailController } from "./controllers/email/email-controller";
var path = require("path");
import multer from "multer";
import { adminUpdateEmailAboutController } from "./controllers/admin/update-email-about-controller";
import { publishSystemUserController } from "./controllers/admin/publish-system-user";
import { checkSubscriptionsController } from "./controllers/cron/check-subscriptions-controller";
import { paymentInController } from "./controllers/alby/payment-in-controller";
import { checkUnsettledInvoicesController } from "./controllers/cron/check-unsettled-invoices-controller";
import { genKeyPairController } from "./controllers/tools/gen-key-pair";
import { checkLastSeenNip05Controller } from "./controllers/cron/check-last-seen-nip05-controller";
import { Nip05SocialRelay } from "./relay/nip05-social-relay";
import { PrismaService } from "./services/prisma-service";
import { Nip05SocialRelayAllowedService } from "./relay/nip05-social-relay-allowed-service";
import { generateRelayStatsController } from "./controllers/cron/generate-relay-stats-controller";
import { emailControllerV2 } from "./controllers/email/email-controller-v2";
import { errorHandler } from "./middlewares/errors";
import { RMService } from "./services/redis-memory-service";
import { CronService } from "./services/cron-service";

import * as swaggerUi from "swagger-ui-express";
import registrationController from "./controllers/v1/registration-controller";
import authMiddleware from "./controllers/auth-middleware";
// eslint-disable-next-line @typescript-eslint/no-var-requires
// const yaml = require("../open-api/schema.yml");
import YAML from "yamljs";
import checkController from "./controllers/v1/check-controller";
import unauthMiddleware from "./controllers/v1/unauth-middleware";
const openApiSchema = YAML.load("./src/open-api/schema.yml");

// Load any environmental variables from the local .env file
dotenv.config();

const GRAPHQL_ENDPOINT = "/graphql";

const app: Express = express();
const port = EnvService.instance.env.PORT;

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiSchema));

app.use(express.json());
app.use(cors());

app.set("views", path.join(__dirname, "views"));
app.engine("html", require("ejs").renderFile);

// API Controller routes
app.get("/.test", testController);
app.get("/.well-known/nostr.json", wellKnownNostrController);
app.get("/.well-known/lnurlp/:username", wellKnownLightningController);
app.get("/hex", hexController);
app.get("/", (req, res /*next*/) => {
    if (req.headers.accept === "application/nostr+json") {
        res.json({
            name: "relay.nip05.social",
            description: "A relay for NIP05.social users.",
            pubkey: "ae064aa171e0d49799252c1034e24b88cdf4fae2328f1736339a41d43567a754",
            contact: "chris@nip05.social",
            supported_nips: [1, 2, 4, 9, 11, 23, 28, 42],
            software: "https://nip05.social/relay",
            version: "0.0.2",
            icon: "https://nip05assets.blob.core.windows.net/public/hive.svg",
            limitation: {
                auth_required: true,
            },
        });
        return;
    }

    if (req.hostname.includes("localhost")) {
        res.send("You are on localhost. No forwarding to any app location.");
        return;
    }

    res.redirect("https://app.nip05.social");
});

// Email Webhook
app.post(
    `/${EnvService.instance.env.EMAIL_ENDPOINT}/`,
    multer().any(),
    emailController
);
app.post(
    `/email-in/${EnvService.instance.env.EMAIL_ENDPOINT_V2}/`,
    multer().any(),
    emailControllerV2
);

app.get(`/${EnvService.instance.env.EMAIL_ENDPOINT}/`, (req, res) => {
    res.json("OK");
});

// Admin controllers
app.get("/admin/update-email-about/:email", adminUpdateEmailAboutController);
app.get("/admin/publish-system-user/:id", publishSystemUserController);

// Cron controllers
app.get("/cron/check-subscriptions", checkSubscriptionsController);
app.get("/cron/check-unsettled-invoices", checkUnsettledInvoicesController);
app.get("/cron/check-last-seen-nip05", checkLastSeenNip05Controller);
app.get("/cron/generate-relay-stats", generateRelayStatsController);

app.get("/tools/gen-key-pair", genKeyPairController);

// Alby controllers
app.post("/alby/payment-in", paymentInController);

// V1 Controllers
app.get(
    "/v1/check/is-available/:id",
    unauthMiddleware,
    checkController.isAvailable
);
app.get(
    "/v1/registrations",
    authMiddleware,
    registrationController.getRegistrations
);
app.get(
    "/v1/registration/:id",
    authMiddleware,
    registrationController.getRegistration
);
app.patch(
    "/v1/registration/:id",
    authMiddleware,
    registrationController.patchRegistration
);

// Error handling
app.use(errorHandler);

// Start RedisMemoryService
RMService.i
    .init({
        redisUrl: EnvService.instance.env.REDIS_URL,
        inMemoryTTL: 60 * 60, // 1 hour
    })
    .then(() => {
        RMService.i.db?.on("debug", (level, data) => {
            if (level === "error") {
                console.log(`${data}`);
            }
        });
    })
    .catch((error) => {
        console.log(error);
    });

// Initialize CronService Debug Logging.
CronService.i.on("debug", (level, data) => {
    console.log(`${data}`);
});

async function bootstrap() {
    //await Migration.i.migrationFixGlobalStats();
    const schema = await buildSchema(schemaOptions);

    app.all(
        GRAPHQL_ENDPOINT,
        createHandler({
            schema,
            context: (req /* params */) => {
                return getGraphqlContext2(req);
            },
        })
    );

    const server = app.listen(port, () => {
        console.log(`⚡️[Server]: Running  on port ${port}`);

        if (EnvService.instance.env.RELAY_START === "0") {
            console.log(`⚡️[Relay]: Not starting the relay.`);
            return;
        }

        console.log(`⚡️[Relay]: Starting the relay...`);

        const wsServer = new WebSocketServer({
            server,
            maxPayload: 131072, // 128KB,

            perMessageDeflate: {
                zlibDeflateOptions: {
                    chunkSize: 1024,
                    memLevel: 7,
                    level: 3,
                },
                zlibInflateOptions: {
                    chunkSize: 10 * 1024,
                },
                clientNoContextTakeover: true, // Defaults to negotiated value.
                serverNoContextTakeover: true, // Defaults to negotiated value.
                serverMaxWindowBits: 10, // Defaults to negotiated value.
                // Below options specified as default values.
                concurrencyLimit: 10, // Limits zlib concurrency for perf.
                threshold: 1024, // Size (in bytes) below which messages
                // should not be compressed if context takeover is disabled.
            },
        });

        PrismaService.instance.db.user
            .findMany({
                select: { pubkey: true },
            })
            .then((result): void => {
                const pubkeys = result.map((x) => x.pubkey);
                Nip05SocialRelayAllowedService.instance.addPubkeys(
                    pubkeys,
                    "auth"
                );
            });

        PrismaService.instance.db.emailNostr
            .findMany({
                select: { pubkey: true },
            })
            .then((x) => {
                Nip05SocialRelayAllowedService.instance.addSystemPubkeys(
                    x.map((x) => x.pubkey),
                    "email-mirror"
                );
            });

        Nip05SocialRelayAllowedService.instance.addSystemPubkeys(
            [
                "d0894d5ace70ee209774d04d5b9aae91efa28ede1954108300c44dabfbe1d9b2",
            ],
            "email-out-bot"
        );

        Nip05SocialRelayAllowedService.instance.addSystemPubkeys(
            [
                "decfe634a6a6a6025fb59d4e139026381242b9ddad6b8d612d370c343942c005", // NIP05.social [Bot]
                "ae064aa171e0d49799252c1034e24b88cdf4fae2328f1736339a41d43567a754", // NIP05.social [Admin]
            ],
            "default"
        );

        Nip05SocialRelay.i.initialize(wsServer, {
            url: EnvService.instance.env.RELAY_URL,
        });
    });

    //Nip05NostrService.instance.start();
}

bootstrap();

