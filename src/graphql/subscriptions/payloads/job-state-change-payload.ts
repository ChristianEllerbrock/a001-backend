export type JobStateChangePayload = {
    relay: string;
    success: boolean;
    item: number;
    ofItems: number;

    destinationFilter: {
        pubkey: string;
        jobId: string;
    };
};

