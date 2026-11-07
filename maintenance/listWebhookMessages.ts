import { TextChannel } from "discord.js";
import client from "../client.ts";

const channelId = "1216817279703187558";

const channel = await client.channels.fetch(channelId) as TextChannel;

const webhooks = await channel.fetchWebhooks();
const webhook = webhooks.find(webhook => webhook.owner?.id === client.user?.id);
if (!webhook) throw new Error("No webhook owned by the bot in this channel.");

console.log(`Webhook: ${webhook.name} (${webhook.id})`);
console.log(`URL: ${webhook.url}`);

const sent: string[] = [];
let before: string | undefined;
let fetched = 0;

while (true) {
    const batch = [...(await channel.messages.fetch(before ? { limit: 100, before } : { limit: 100 })).values()];
    if (batch.length === 0) {
        console.log("Reached the start of the channel.");
        break;
    }

    fetched += batch.length;
    const oldest = batch[batch.length - 1];
    console.log(`Fetched ${batch.length} message(s) (${fetched} total), down to ${oldest.id} (${new Date(oldest.createdTimestamp).toISOString()})`);

    let matched = 0;
    for (const message of batch) {
        if (message.webhookId !== webhook.id) continue;
        matched++;
        sent.push(`${message.id} ${new Date(message.createdTimestamp).toISOString()} ${JSON.stringify(message.content)}`);
        console.log(`  match ${message.id} from ${new Date(message.createdTimestamp).toISOString()}`);
    }
    console.log(`  ${matched} from the webhook in this batch, ${sent.length} total so far`);

    if (batch.length < 100) break;
    before = oldest.id;
}

console.log(`${sent.length} message(s) sent by the webhook:`);
for (const line of sent.reverse()) console.log(line);

await client.destroy();
