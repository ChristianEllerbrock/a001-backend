import { DateTime } from "luxon";
import { Relay } from "nostr-tools";
import { OPEN } from "ws";

class RelayPatient {
    hospitalized: Date[] = [];
    recovered: Date[] = [];
    uptimeInSeconds: number[] = [];
    overallNoOfTherapies = 0;
    noOfTherapiesInARow = 0;

    #therapyTimeout: NodeJS.Timeout | undefined;
    #debug: boolean;
    #curedCallback: (() => void) | undefined;

    constructor(
        public relay: Relay,
        curedCallback: () => void,
        debug: boolean | undefined = false
    ) {
        this.#debug = debug;
        this.#curedCallback = curedCallback;
    }

    setCuredCallback(cb: () => void) {
        this.#curedCallback = cb;
    }

    async startTherapy() {
        if (this.#therapyTimeout) {
            // Therapy already ongoing. Do nothing.
            return;
        }

        this.overallNoOfTherapies++;
        this.noOfTherapiesInARow++;

        const now = new Date();
        this.hospitalized.push(now);
        const lastRecovered = this.recovered
            .sortBy((x) => x.getTime(), "desc")
            .find((x) => x.getTime() < now.getTime());
        if (lastRecovered) {
            const uptimeInSeconds = DateTime.fromJSDate(now)
                .diff(DateTime.fromJSDate(lastRecovered), "seconds")
                .toObject().seconds;
            if (uptimeInSeconds) {
                this.uptimeInSeconds.push(uptimeInSeconds);
            }
        }

        this.#log(
            `Doctor is starting ${this.overallNoOfTherapies}. therapy (${this.noOfTherapiesInARow} in a row) on patient '${this.relay.url}'`
        );

        this.#therapyTimeout = setTimeout(async () => {
            // First check if for some reason the relay is healthy.
            if (this.relay.status === OPEN) {
                this.recovered.push(new Date());
                this.#therapyTimeout = undefined;
                this.noOfTherapiesInARow = 0;
                this.#log(`Patient '${this.relay.url}' has recovered.`);
                if (this.#curedCallback) {
                    this.#curedCallback();
                }
                return;
            }

            // Try to connect.
            this.#log(`Trying to reconnect on patient '${this.relay.url}'.`);
            try {
                await this.relay.connect();
            } catch (error) {}

            if (this.relay.status === OPEN) {
                this.recovered.push(new Date());
                this.#therapyTimeout = undefined;
                this.noOfTherapiesInARow = 0;
                this.#log(
                    `Success for therapy on patient '${this.relay.url}'.`
                );
                if (this.#curedCallback) {
                    this.#curedCallback();
                }
                return;
            }

            // Start another therapy.
            this.#therapyTimeout = undefined;
            this.#log(
                `Therapy was NOT successful on patient '${this.relay.url}'. Start another one.`
            );
            this.startTherapy();
        }, this.#calculateTherapyTimeout());
    }

    setDebug(debug: boolean) {
        this.#debug = debug;
    }

    #calculateTherapyTimeout(): number {
        // First 100 every 10s
        // After that every 5 minutes
        if (this.noOfTherapiesInARow <= 100) {
            return 10 * 1000;
        }

        return 2 * 60 * 1000;
    }

    #log(text: string) {
        if (!this.#debug) {
            return;
        }
        console.log(`NostrDMWatcherDoctor - ` + text);
    }
}

export type NostrDMWatcherDoctorPatientInfo = {
    noOfDisconnects: number;
    timesBetweenDisconnects: Date[];
    uptimesInSeconds: number[];
};

export class NostrDMWatcherDoctor {
    #relayPatients = new Map<string, RelayPatient>();

    #debug: boolean;

    constructor(debug: boolean) {
        this.#debug = debug;
    }

    cure(relay: Relay, curedCallback: () => void) {
        if (relay.status === OPEN) {
            // Nothing to cure. "Patient" is well.
            return;
        }

        let relayPatient = this.#relayPatients.get(relay.url);
        if (!relayPatient) {
            relayPatient = new RelayPatient(relay, curedCallback, this.#debug);
            this.#relayPatients.set(relay.url, relayPatient);
        } else {
            relayPatient.setCuredCallback(curedCallback);
        }

        relayPatient.startTherapy();
    }

    getPatientInfos(): Map<string, NostrDMWatcherDoctorPatientInfo> {
        const infos = new Map<string, NostrDMWatcherDoctorPatientInfo>();
        for (const patient of this.#relayPatients.values()) {
            infos.set(patient.relay.url, {
                noOfDisconnects: patient.overallNoOfTherapies,
                timesBetweenDisconnects: patient.hospitalized,
                uptimesInSeconds: patient.uptimeInSeconds,
            });
        }
        return infos;
    }

    setDebug(debug: boolean) {
        this.#debug = debug;

        for (const relayPatient of this.#relayPatients.values()) {
            relayPatient.setDebug(debug);
        }
    }
}

