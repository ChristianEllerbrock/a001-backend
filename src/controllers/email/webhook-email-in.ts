import { RegistrationEmailIn } from "@prisma/client";
import { ParsedMail, SMTPServerSession } from "./@types";

export type WebhookAttachments = {
    numberOfAttachments: number;
};

export type WebhookEmailInData = {
    from: string[];
    to: string[];
    subject: string | undefined;
    text: string | false;
    noOfAttachments: number;
};

export type WebhookEmailInProcessedRegistrationDetails = {
    registrationId: string;
    subscriptionMaxNoOfInboundEmailsPer30Days: number;
    emailForwardingOn: boolean;
    registrationEmailIns: RegistrationEmailIn[];
    userPubkey: string;
};

type WebhookEmailInProcessed = {
    to: [
        address: string,
        nip05DomainId: number | undefined,
        registrationDetails:
            | WebhookEmailInProcessedRegistrationDetails
            | undefined
    ][];
};

export class WebhookEmailIn {
    #session: SMTPServerSession | undefined;
    #parsed: ParsedMail | undefined;
    #attachments: WebhookAttachments | undefined;

    data: WebhookEmailInData = {
        from: [],
        to: [],
        subject: undefined,
        text: false,
        noOfAttachments: 0,
    };

    processed: WebhookEmailInProcessed = {
        to: [],
    };

    constructor(body: any) {
        this.#session = body.session;
        this.#parsed = body.parsed;
        this.#attachments = body.webhookAttachments;

        this.#build();
    }

    /** Returns the lowercase domain part of an email. */
    getDomain(email: string) {
        return email.toLowerCase().split("@")[1];
    }

    isValid(): boolean {
        if (this.data.from.length === 0) {
            return false;
        }

        if (this.data.to.length === 0) {
            return false;
        }

        if (
            typeof this.data.subject === "undefined" &&
            this.data.text === false
        ) {
            return false;
        }

        return true;
    }

    #build() {
        if (!this.#parsed || !this.#session) {
            return;
        }

        try {
            // Determine FROM (array).
            this.data.from = (this.#parsed.from?.value
                .filter((x) => typeof x.address !== "undefined")
                .map((x) => x.address?.toLowerCase()) ?? []) as string[];

            // Determine TO (array) from session (!important).
            const to = new Set<string>(
                this.#session.envelope.rcptTo.map((x) =>
                    x.address.toLowerCase()
                )
            );
            if (to.size > 0) {
                this.data.to = Array.from(to);
            }

            // Determine TO (array).
            // if (typeof this.#parsed.to !== "undefined") {
            //     const to = new Set<string>();

            //     // "to" could be an array or single object.
            //     if (Array.isArray(this.#parsed.to)) {
            //         for (const objectTo of this.#parsed.to) {
            //             const objectToItems = (objectTo.value
            //                 .filter((x) => typeof x.address !== "undefined")
            //                 .map((x) => x.address?.toLowerCase()) ??
            //                 []) as string[];
            //             objectToItems.forEach((x) => to.add(x));
            //         }
            //     } else {
            //         const objectToItems = (this.#parsed.to.value
            //             .filter((x) => typeof x.address !== "undefined")
            //             .map((x) => x.address?.toLowerCase()) ??
            //             []) as string[];
            //         objectToItems.forEach((x) => to.add(x));
            //     }

            //     if (to.size > 0) {
            //         this.data.to = Array.from(to);
            //     }
            // }

            // Determine TEXT (string).
            this.data.text = this.#parsed.text ?? this.#parsed.html;

            // Determine SUBJECT (string).
            this.data.subject = this.#parsed.subject;

            // Determine ATTACHMENT.
            this.data.noOfAttachments =
                this.#attachments?.numberOfAttachments ?? 0;
        } catch (error) {
            // Do nothing.
        }
    }
}

