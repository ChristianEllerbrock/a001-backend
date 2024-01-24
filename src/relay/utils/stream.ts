import { Transform } from "stream";

export const streamMap = (fn: (chunk: any) => any) =>
    new Transform({
        objectMode: true,
        transform(chunk, _encoding, callback) {
            callback(null, fn(chunk));
        },
    });

export const streamFilter = (predicate: (chunk: any) => boolean) =>
    new Transform({
        objectMode: true,
        transform(chunk, _encoding, callback) {
            if (predicate(chunk)) {
                return callback(null, chunk);
            }

            callback();
        },
    });

