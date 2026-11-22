import { TextChannel } from "discord.js";
import client from "../client.ts";

const channelId = "1570669250304020490";

const channel = await client.channels.fetch(channelId) as TextChannel;

const webhooks = await channel.fetchWebhooks();
const webhook = webhooks.first();

if (!webhook?.token) {
  throw new Error("No usable webhook found in this channel.");
}

const message = await webhook.send(
  `Rate Millennavia 5 (1–10)\nTo vote, please select a rating using the reactions below.`
);

const reactions = [
  "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣",
  "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"
];

for (const reaction of reactions) {
  await message.react(reaction);
}