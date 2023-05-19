export enum JobType {
    NostrDirectMessage = 1,
}

export const jobTypes = new Map<number, string>([
    [JobType.NostrDirectMessage, "nostr direct message"],
]);

