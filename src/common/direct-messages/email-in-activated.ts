const message = function (nostrAddress: string) {
    const text =
        `You have activated "EMAIL IN" for your #nostr address ${nostrAddress}\n` +
        `\n` +
        `#Emails to this address will be delivered as direct messages via the following relays:\n` +
        `\n` +
        `+ relay.nip05.social (our private relay for registered users)\n` +
        `\n` +
        `+ all relays you have configured in your settings "NIP-05 Relays"\n` +
        `\n` +
        `+ some general public relays \n` +
        `\n` +
        `+ all read-relays found in any NIP-65 relay list published on the relays above\n` +
        `\n` +
        `\n` +
        `A nostr identity will be created for an email sender address acting as your direct message counterpart.\n` +
        `\n` +
        `\n` +
        `Please make sure that your client supports NIP-42 authentication when you add` +
        ` 'relay.nip05.social' to its relay list.`;

    return text;
};

export default message;

