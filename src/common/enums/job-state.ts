export enum JobState {
    Created = 1,
    Running = 2,
    Finished = 3,
}

export const jobStates = new Map<number, string>([
    [JobState.Created, "created"],
    [JobState.Running, "running"],
    [JobState.Finished, "finished"],
]);

