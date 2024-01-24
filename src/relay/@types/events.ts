export type EventId = string;

export interface DBEvent {
    id: string;
    pubkey: string;
    kind: number;
    created_at: number;
    tags: any[][];
    signature: string;
    content: string;
}

