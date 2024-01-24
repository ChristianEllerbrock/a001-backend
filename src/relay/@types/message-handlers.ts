import { IncomingMessage } from "./messages";

export interface IMessageHandler {
    handleMessage(message: IncomingMessage): Promise<void>;
}

export interface IAbortable {
    abort(): void;
}

