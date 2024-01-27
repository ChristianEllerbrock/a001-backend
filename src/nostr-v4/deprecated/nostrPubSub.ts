// import EventEmitter from "events";
// import { RelayEvent } from "./type-defs";

// export class NostrPubSub {
//     #engine = new Map<string, EventEmitter>();

//     on(
//         channelId: string,
//         listener: (eos: boolean, relayEvents: RelayEvent[]) => void
//     ): void {
//         if (this.#engine.has(channelId)) {
//             return;
//         }

//         const emitter = new EventEmitter();
//         this.#engine.set(channelId, emitter);
//         emitter.on(channelId, listener);
//     }

//     off(channelId: string) {
//         const emitter = this.#engine.get(channelId);

//         if (!emitter) {
//             return;
//         }

//         emitter.removeAllListeners();
//         this.#engine.delete(channelId);
//     }

//     async emitAsync(
//         channelId: string,
//         eos: boolean,
//         relayEvents: RelayEvent[]
//     ) {
//         const engine = this.#engine.get(channelId);

//         if (!engine) {
//             throw new Error(`No engine found for channelId '${channelId}'`);
//         }

//         engine.emit(channelId, eos, relayEvents);
//         if (eos) {
//             engine.removeAllListeners();
//             this.#engine.delete(channelId);
//         }
//     }
// }

