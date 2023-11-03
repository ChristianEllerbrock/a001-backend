export enum SystemDomain {
    Nip05Social = "nip05.social",
    Nip05Cloud = "nip05.cloud",
    NostrcomCom = "nostrcom.com",
    UnitednostrCom = "unitednostr.com",
    ProtonostrCom = "protonostr.com",
    NostridInfo = "nostrid.info",
}

export const systemDomainIds = new Map<string, number>([
    [SystemDomain.Nip05Social, 1],
    [SystemDomain.Nip05Cloud, 2],
    [SystemDomain.NostrcomCom, 3],
    [SystemDomain.UnitednostrCom, 4],
    [SystemDomain.ProtonostrCom, 5],
    [SystemDomain.NostridInfo, 6],
]);

