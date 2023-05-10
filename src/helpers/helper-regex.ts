export class HelperRegex {
    static isValidRelay(address: string): boolean {
        const regExp = /^wss:\/\/[A-Z0-9.-]+\.[A-Z]{2,}$/i;

        return regExp.test(address);
    }
}

