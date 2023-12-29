import axios, { HttpStatusCode } from "axios";
import { EnvService } from "./env-service";

export type AlbyCreateInvoice = {
    expires_at: string;
    payment_hash: string;
    payment_request: string;
    qr_code_png: string;
    qr_code_svg: string;
};

type AlbyCreateInvoiceBody = {
    amount: number;
    description?: string;
    metadata: AlbyInvoiceMetadata;
};

type AlbyInvoiceMetadata = {
    userSubscriptionId: number;
    environment: "dev" | "pro";
};

export class AlbyService {
    static #instance: AlbyService;
    static get instance() {
        if (AlbyService.#instance) {
            return AlbyService.#instance;
        }

        AlbyService.#instance = new AlbyService();
        return AlbyService.#instance;
    }

    async createInvoice(
        userSubscriptionId: number,
        amount: number,
        description: string | undefined = undefined
    ): Promise<AlbyCreateInvoice> {
        const url = "https://api.getalby.com/invoices";
        const body: AlbyCreateInvoiceBody = {
            amount,
            metadata: {
                userSubscriptionId,
                environment: EnvService.instance.env.ENVIRONMENT,
            },
        };

        if (description) {
            body.description = description;
        }

        // TODO

        const result = await axios.post<AlbyCreateInvoice>(url, body, {
            headers: {
                Authorization:
                    "Bearer " + EnvService.instance.env.ALBY_ACCESS_TOKEN,
            },
        });

        console.log(result.data);

        if (result.data) {
            return result.data;
        }

        throw new Error(result.statusText);
    }
}

