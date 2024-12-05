import { Response, Request } from "express";
import { HelperIdentifier } from "../../helpers/identifier";
import { HelperRegex } from "../../helpers/helper-regex";
import { IsAvailableDto } from "@open-api";
import { UnauthRequest } from "../unauth-middleware";

const isAvailable = async function (
    req: Request,
    res: Response
    /*next: NextFunction*/
) {
    const nostrAddress = req.params.id;
    if (HelperRegex.isValidNostrAddress(nostrAddress) === false) {
        res.status(400).json({ message: "Invalid Nostr Address" });
        return;
    }

    const extendedReq = req as UnauthRequest;
    const [identifier, domain] = nostrAddress.toLowerCase().split("@");

    // Get the system domain id.
    const sqlSystemDomain =
        await extendedReq.context.sql.systemDomain.findFirst({
            where: {
                name: domain.trim(),
            },
        });

    if (!sqlSystemDomain) {
        res.status(404).json({ message: "Invalid domain" });
        return;
    }

    const checkResult = await HelperIdentifier.canIdentifierBeRegisteredAsync(
        identifier.trim(),
        sqlSystemDomain?.id
    );

    const isAvailableDto: IsAvailableDto = {
        nostrAddress: nostrAddress.toLowerCase().trim(),
        isAvailable: checkResult.canBeRegistered,
        reason: checkResult.reason,
    };

    res.status(200).json(isAvailableDto);
};

export default { isAvailable };

