import * as crypto from "node:crypto";

export class HelperAuth {
    static generateCode(): string {
        const array = new Uint32Array(1);
        crypto.getRandomValues(array);

        return array[0].toString().slice(0, 6);
    }
}

