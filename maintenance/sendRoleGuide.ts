import { postRoleInformation } from "../roleInformation.ts";

// bun run maintenance/sendRoleGuide.ts CHANNEL_ID
const [channelId] = process.argv.slice(2);
if (process.argv.length !== 3 || !channelId || !/^\d+$/.test(channelId)) {
    throw new Error("Usage: bun run maintenance/sendRoleGuide.ts CHANNEL_ID");
}

const { default: client } = await import("../client.ts");

try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isSendable()) throw new Error("The channel does not support sending messages.");
    await postRoleInformation(channel);
} finally {
    await client.destroy();
}
