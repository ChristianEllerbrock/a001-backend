const message = function (nostrAddress: string) {
    const text =
        `You have activated "EMAIL OUT" for your #nostr address ${nostrAddress}\n` +
        `\n` +
        `In oder to send #emails as direct messages on #nostr, you need to add our` +
        ` private relay relay.nip05.social to your client's relay list. Please make` +
        ` sure that your client supports NIP-42 authentication.\n` +
        `\n` +
        `Overall, you have 2 options to send emails:\n` +
        `\n` +
        `a) send a direct message to our dedicated` +
        ` @npub16zy56kkwwrhzp9m56px4hx4wj8h69rk7r92ppqcqc3x6h7lpmxeq7cyjuy` +
        ` IN A VERY SPECIFIC FORMAT\n` +
        `\n` +
        `b) respond to a previously received direct message from one of the email nostr identities\n` +
        `\n` +
        `For both options, you can always send a direct message to the bots` +
        ` with just the content "help",` +
        ` and they will automatically respond with a message explaining all your options.`;

    return text;
};

export default message;

