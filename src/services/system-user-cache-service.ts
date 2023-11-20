import { SystemUser } from "@prisma/client";
import { PrismaService } from "./prisma-service";

export class SystemUserCacheService {
    static #instance: SystemUserCacheService;

    static get instance() {
        if (this.#instance) {
            return this.#instance;
        }

        this.#instance = new SystemUserCacheService();
        return this.#instance;
    }

    #isInitialized = false;

    systemUsers:
        | ({
              systemUserRelays: {
                  id: number;
                  systemUserId: number;
                  url: string;
              }[];
          } & {
              id: number;
              pubkey: string;
              keyvaultKey: string;
              nip05: string;
              name: string | null;
              about: string | null;
              picture: string | null;
              banner: string | null;
              lookups: number;
              lastLookupDate: Date | null;
          })[]
        | undefined;

    /**
     * Loads the data ONCE from the database when this method is called.
     */
    async initialize() {
        if (this.#isInitialized) {
            return;
        }

        const dbSystemUsers =
            await PrismaService.instance.db.systemUser.findMany({
                include: {
                    systemUserRelays: true,
                },
            });

        this.systemUsers = dbSystemUsers;

        this.#isInitialized = true;
    }
}

