import { BaseGuildTextChannel } from "discord.js";
import { writeFile } from "node:fs/promises";
import client from "../client.ts";

const channelId = "1217494766397296771";
const channel = await client.channels.fetch(channelId);
if (!(channel instanceof BaseGuildTextChannel)) throw new Error(`${channelId} is not a text channel.`);
console.log(`Reading #${channel.name} (${channel.id})...`);

const messages: { channel: string; timestamp: number; author: string; content: string }[] = [];

let before: string | undefined;
let page = 0;

while (true) {
    const batch = [...(await channel.messages.fetch(before ? { limit: 100, before } : { limit: 100 })).values()];
    if (batch.length === 0) break;
    page++;

    for (const message of batch) {
        messages.push({
            channel: `#${channel.name}`,
            timestamp: message.createdTimestamp,
            author: message.author.tag,
            content: message.content,
        });
    }

    console.log(`Fetched page ${page}: ${batch.length} message(s), ${messages.length} total.`);
    if (batch.length < 100) break;
    before = batch[batch.length - 1].id;
}

console.log(`Finished fetching ${messages.length} message(s) across ${page} page(s).`);
console.log(`Sorting ${messages.length} message(s) by timestamp...`);
messages.sort((a, b) => a.timestamp - b.timestamp);
const output = messages.map(message =>
    `[${new Date(message.timestamp).toISOString()}] ${message.channel} | ${message.author}\n${message.content}`
).join("\n\n");
const filename = `messages-${channelId}.txt`;

await writeFile(filename, output, "utf8");
console.log(`Wrote ${messages.length} message(s) (${output.length} characters) to ${filename}.`);
await client.destroy();
