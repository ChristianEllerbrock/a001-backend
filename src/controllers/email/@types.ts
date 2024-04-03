import * as tls from "tls";

export interface AttachmentCommon {
    type: "attachment";
    content: any;
    contentType: string;
    contentDisposition: string;
    filename?: string | undefined;
    headers: Headers;
    headerLines: HeaderLines;
    checksum: string;
    size: number;
    contentId?: string | undefined;
    cid?: string | undefined; // e.g. '5.1321281380971@localhost'
    related?: boolean | undefined;
}

export interface Attachment extends AttachmentCommon {
    /**
     * A Buffer that contains the attachment contents.
     */
    content: Buffer;
    /**
     * If true then this attachment should not be offered for download
     * (at least not in the main attachments list).
     */
    related: boolean;
}

export interface StructuredHeader {
    value: string;
    params: { [key: string]: string };
}

export interface EmailAddress {
    address?: string | undefined;
    name: string;
    group?: EmailAddress[] | undefined;
}

export interface AddressObject {
    value: EmailAddress[];
    html: string;
    text: string;
}

export type HeaderValue =
    | string
    | string[]
    | AddressObject
    | Date
    | StructuredHeader;

export type Headers = Map<string, HeaderValue>;

export type HeaderLines = ReadonlyArray<{
    key: string;
    line: string;
}>;

export interface ParsedMail {
    attachments: Attachment[];
    headers: Headers;
    headerLines: HeaderLines;
    html: string | false;
    text?: string | undefined;
    textAsHtml?: string | undefined;
    subject?: string | undefined;
    references?: string[] | string | undefined;
    date?: Date | undefined;
    to?: AddressObject | AddressObject[] | undefined;
    from?: AddressObject | undefined;
    cc?: AddressObject | AddressObject[] | undefined;
    bcc?: AddressObject | AddressObject[] | undefined;
    replyTo?: AddressObject | undefined;
    messageId?: string | undefined;
    inReplyTo?: string | undefined;
    priority?: "normal" | "low" | "high" | undefined;
}

export interface SMTPServerSession {
    id: string;
    localAddress: string;
    localPort: number;
    remoteAddress: string;
    remotePort: number;
    clientHostname: string;
    openingCommand: string;
    hostNameAppearsAs: string;
    envelope: SMTPServerEnvelope;
    secure: boolean;
    transmissionType: string;
    tlsOptions: tls.TlsOptions;
    user?: string | undefined;
}

export interface SMTPServerEnvelope {
    mailFrom: SMTPServerAddress | false;
    rcptTo: SMTPServerAddress[];
}

export interface SMTPServerAddress {
    address: string;
    args: object;
}

