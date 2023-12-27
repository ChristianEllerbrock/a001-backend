type DbUser = {
    subscription: {
        id: number;
        name: string;
        satsPer30Days: number;
        maxNoOfNostrAddresses: number;
        maxNoOfInboundEmailsPer30Days: number;
        maxNoOfOutboundEmailsPer30Days: number;
    };
} & {
    id: string;
    pubkey: string;
    createdAt: Date;
    isSystemUser: boolean | null;
    fraudReportedAt: Date | null;
    isSystemAgent: boolean;
    subscriptionId: number;
    subscriptionEnd: Date | null;
};

type DbSystemUser =
    | {
          systemUserRelays: {
              id: number;
              systemUserId: number;
              url: string;
          }[];
          systemUserDms: {
              id: number;
              systemUserId: number;
              eventId: string;
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
      };

type DbEmailNostr = {
    email: {
        id: number;
        address: string;
        createdAt: Date;
        keyvaultKey: string;
    };
    emailNostrProfiles: {
        id: number;
        emailNostrId: number;
        publishedAt: Date;
        publishedRelay: string;
    }[];
    emailNostrDms: {
        id: number;
        emailNostrId: number;
        eventId: string;
        eventCreatedAt: number;
        sent: Date | null;
    }[];
} & {
    id: number;
    emailId: number;
    pubkey: string;
    nip05: string;
    name: string | null;
    about: string | null;
    picture: string | null;
    banner: string | null;
    lookups: number;
    lastLookupDate: Date | null;
};

