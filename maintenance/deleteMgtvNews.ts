
import { TextChannel } from "discord.js";
import client from "../client.ts";

const channelId = "1217494766397296771";
const since = Date.parse("2026-10-29T00:00:00Z");

const snippets = [
    "MGTVNEWS 2026.10.29",
    "President, I would grow a strong connection with him despite our arguments and view him as my definite successor. However, with arguments",
];

const channel = await client.channels.fetch(channelId) as TextChannel;

let before: string | undefined;
let matched = 0;
let deleted = 0;

const matches = [];

try {
    // Search channel history
    while (true) {
        const batch = [
            ...(await channel.messages.fetch(
                before
                    ? { limit: 100, before }
                    : { limit: 100 }
            )).values()
        ];

        if (batch.length === 0) break;

        for (const message of batch) {
            // Ignore messages before the cutoff date
            if (message.createdTimestamp < since) continue;

            // Check whether the message contains either snippet
            if (!snippets.some(snippet =>
                message.content.includes(snippet)
            )) {
                continue;
            }

            matches.push(message);
            matched++;

            console.log(
                `Matched ${message.id} | ${new Date(message.createdTimestamp).toISOString()}`
            );
        }

        const oldest = batch[batch.length - 1];

        // Stop once we've reached the cutoff date
        if (
            batch.length < 100 ||
            oldest.createdTimestamp < since
        ) {
            break;
        }

        before = oldest.id;
    }

    console.log(`Found ${matched} matching messages.`);

    // Delete messages in batches of up to 100
    for (let i = 0; i < matches.length; i += 100) {
        const chunk = matches.slice(i, i + 100);

        try {
            if (chunk.length === 1) {
                // Bulk deletion requires at least 2 messages
                await chunk[0].delete();
                deleted++;
            } else {
                // Use Discord bulk delete endpoint
                const result = await channel.bulkDelete(chunk, true);
                deleted += result.size;
            }

            console.log(
                `Deleted batch ${Math.floor(i / 100) + 1}: ${chunk.length} requested.`
            );
        } catch (error) {
            console.error(
                `Failed to delete batch ${Math.floor(i / 100) + 1}:`,
                error
            );
        }
    }

    console.log("--------------------------------");
    console.log(`Matched: ${matched}`);
    console.log(`Deleted: ${deleted}`);
    console.log(`Failed or skipped: ${matched - deleted}`);

} finally {
    await client.destroy();
}
