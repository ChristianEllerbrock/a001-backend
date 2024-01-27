export interface Nip05 {
    names: { [key: string]: string };
    relays?: { [key: string]: string[] };
}

export type NostrPubkeyObject = {
    hex: string;
    npub: string;
};

