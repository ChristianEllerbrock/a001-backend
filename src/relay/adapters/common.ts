import { debug } from "console";

export const createLogger = function (namespace: string) {
    const log = function (message: any) {
        debug(`${namespace}: ${message}`);
    };
    return log;
};

