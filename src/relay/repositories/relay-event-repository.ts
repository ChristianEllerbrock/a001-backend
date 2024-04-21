import { Event, Filter } from "nostr-tools";
import { PrismaService } from "../../services/prisma-service";
import { RelayEvent } from "@prisma/client";
import {
    EventMeaning,
    getEventDTagValue,
    getEventMeaning,
} from "../utils/event";
import { RMService } from "../../services/redis-memory-service";
import { R_RelayEvent } from "../../types/redis/@types";

export class RelayEventRepository {
    // #region Singleton
    static #instance: RelayEventRepository;

    static get instance() {
        if (this.#instance) {
            return this.#instance;
        }

        this.#instance = new RelayEventRepository();
        return this.#instance;
    }

    // #endregion Singleton

    /**
     * Creates the event in the database. Returns "-1" if the event
     * already exists and "1" if it is new.
     *
     * This method is intended for RegularEvents.
     */
    async create(event: Event): Promise<number> {
        // Check, if the eventId already exists.
        const dbEvent = await PrismaService.instance.db.relayEvent.findUnique({
            where: { id: event.id },
        });
        if (dbEvent) {
            return -1;
        }

        // The event does not exist. Create it.
        await this.#create(event);
        return +1;
    }

    /**
     * Updates existing ReplaceableEvents or ParameterizedReplaceableEvents
     *
     * Returns "-1" if the database has a newer version. Returns "1" when
     * the event is newest and the database will be updated.
     *
     * This method is intended for ReplaceableEvents or ParameterizedReplaceableEvents.
     */
    async upsert(event: Event) {
        const meaning = getEventMeaning(event);
        if (
            [
                EventMeaning.ReplaceableEvent,
                EventMeaning.ParameterizedReplaceableEvent,
            ].includes(meaning)
        ) {
            throw new Error(
                `Cannot upsert the ${meaning} event in the database.`
            );
        }

        // Check, if the database holds any version.
        let dbRelayEvent: RelayEvent | null | undefined;

        if (meaning === EventMeaning.ReplaceableEvent) {
            dbRelayEvent = await PrismaService.instance.db.relayEvent.findFirst(
                {
                    where: { kind: event.kind, pubkey: event.pubkey },
                }
            );
        } else {
            // ParameterizedReplaceableEvents
            const dTagValue = getEventDTagValue(event);
            if (!dTagValue) {
                throw new Error("Event does not have a 'd' tag value");
            }

            dbRelayEvent = await PrismaService.instance.db.relayEvent.findFirst(
                {
                    where: {
                        kind: event.kind,
                        pubkey: event.pubkey,
                        relayEventTags: {
                            some: { name: "d", value: dTagValue },
                        },
                    },
                }
            );
        }

        if (!dbRelayEvent) {
            // The database has no version at all. Insert the event into the database.
            await this.#create(event);
            return 1;
        }

        // We already have stored another version in the database.
        // Determine what to do.

        if (event.created_at > dbRelayEvent.created_at) {
            // The event version if more recent.
            await PrismaService.instance.db.$transaction(async (tx) => {
                // Delete existing database records.
                await tx.relayEvent.delete({ where: { id: event.id } });

                await this.#create(event);
            });
            return 1;
        } else {
            // The database version is more recent.
            return -1;
        }
    }

    async findByFilters(filters: Filter[]): Promise<Event[]> {
        //return [];

        const unionSql: string[] = [];
        for (const filter of filters) {
            const andSql: string[] = [];

            if (typeof filter.ids !== "undefined") {
                andSql.push(
                    `re.id IN (${filter.ids
                        .map((x) => "'" + x + "'")
                        .join(", ")})`
                );
            }

            if (typeof filter.authors !== "undefined") {
                andSql.push(
                    `re.pubkey in (${filter.authors
                        .map((x) => "'" + x + "'")
                        .join(", ")})`
                );
            }

            if (typeof filter.kinds !== "undefined") {
                andSql.push(`re.kind in (${filter.kinds.join(", ")})`);
            }

            if (typeof filter.since !== "undefined") {
                andSql.push(`re.created_at >= ${filter.since}`);
            }

            if (typeof filter.until !== "undefined") {
                andSql.push(`re.created_at <= ${filter.since}`);
            }

            for (const key of Object.keys(filter)) {
                if (!key.includes("#") || key.length !== 2) {
                    continue;
                }

                // We have a "#" key (e.g. "#e" or "#p").
                let tagName = key;
                tagName = tagName.replace("#", "");
                const tagValues = filter[`#${tagName}`] ?? [];

                if (!tagValues.empty()) {
                    andSql.push(
                        `tag.[name] = '${tagName}' AND tag.[value] IN (${tagValues
                            .map((x) => "'" + x + "'")
                            .join(", ")})`
                    );
                }
            }

            // Build SQL
            const topN =
                typeof filter.limit !== "undefined"
                    ? `TOP(${filter.limit})`
                    : "TOP(100) PERCENT";

            const sql = `
            SELECT ${topN} 
            re.* 
            FROM [dbo].[RelayEvent] re
            LEFT JOIN 
            (SELECT ROW_NUMBER() OVER(PARTITION BY relayEventId ORDER BY id) row#, id, relayEventId, [name], [value] FROM [dbo].[RelayEventTag]) tag ON re.id = tag.relayEventId
            WHERE (
                (tag.row# = 1 OR tag.row# IS NULL)              
                ${
                    andSql.length === 0
                        ? ""
                        : "AND " +
                          andSql.map((x) => "(" + x + ")").join(" AND ")
                }
            ) ORDER BY re.created_at`;
            unionSql.push(sql);
        }

        const rawSql = unionSql
            .map((sql) => `SELECT * FROM (${sql}) query`)
            .join(" UNION ");

        //console.log(rawSql);

        const events = await PrismaService.instance.db.$queryRawUnsafe<
            RelayEvent[]
        >(rawSql);
        //console.log(events);

        return events.map((event) => this.#toNostrEvent(event));
    }

    /**
     * Deletes all references in the database of a NIP-05 delete event.
     * This method does NOT store the deletion event automatically.
     * This must be triggered separately by a call to "create"
     */
    async delete(event: Event): Promise<void> {
        if (event.kind !== 5) {
            throw new Error("The event is not a kind 5 deletion event");
        }

        const eTagValues: string[] = [];
        const aTagValues: string[] = [];
        for (const tag of event.tags) {
            if (tag[0] === "e") {
                eTagValues.push(tag[1]);
            } else if (tag[0] === "a") {
                aTagValues.push(tag[1]);
            }
        }

        await PrismaService.instance.db.$transaction(async (tx) => {
            // Delete all e references
            await tx.relayEvent.deleteMany({
                where: {
                    id: { in: eTagValues },
                    pubkey: event.pubkey, // reference must be from "deleter"
                },
            });

            // Delete all a references
            for (const aTagValue of aTagValues) {
                const [kind, pubkey, dValue] = aTagValue.split(":");

                await tx.relayEvent.deleteMany({
                    where: {
                        kind: parseInt(kind),
                        pubkey, // reference must be from "deleter"
                        relayEventTags: {
                            some: {
                                name: "d",
                                value: dValue,
                            },
                        },
                    },
                });
            }
        });
    }

    #toNostrEvent(dbRelayEvent: RelayEvent): Event {
        return {
            id: dbRelayEvent.id,
            created_at: dbRelayEvent.created_at,
            kind: dbRelayEvent.kind,
            pubkey: dbRelayEvent.pubkey,
            content: dbRelayEvent.content,
            sig: dbRelayEvent.sig,
            tags: JSON.parse(dbRelayEvent.tags),
        };
    }

    async #create(event: Event) {
        const rRelayEvent: R_RelayEvent = {
            ...event,
            _tags: this.#buildTagObject(event),
        };
        await RMService.i.relayEvent.save(event.id, rRelayEvent);

        await PrismaService.instance.db.$transaction(async (tx) => {
            const newDbEvent = await tx.relayEvent.create({
                data: {
                    id: event.id,
                    kind: event.kind,
                    pubkey: event.pubkey,
                    created_at: event.created_at,
                    content: event.content,
                    sig: event.sig,
                    tags: JSON.stringify(event.tags),
                },
            });

            // Create relations.
            if (!event.tags.empty()) {
                await tx.relayEventTag.createMany({
                    data: event.tags.map((x) => {
                        return {
                            relayEventId: newDbEvent.id,
                            name: x[0],
                            value: x[1],
                        };
                    }),
                });
            }
        });
    }

    #buildTagObject(event: Event): { [key: string]: string } {
        const tagObject: { [key: string]: string } = {};
        for (const tag of event.tags) {
            tagObject[tag[0]] = tag[1];
        }

        return tagObject;
    }
}

