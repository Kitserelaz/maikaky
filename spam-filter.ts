
import { Events, type Message } from "discord.js";
import client from "./client.ts";

const WINDOW_MS = 20_000;
const MIN_MESSAGES = 5;
const MIN_CHANNELS = 3;
const MIN_IMAGES = 4;

const TIMEOUT_MS = 60 * 60 * 1000; // 1 hour
const DETECTION_COOLDOWN_MS = 60_000;

type TrackedMessage = {
  message: Message<true>;
  timestamp: number;
};

const activity = new Map<string, TrackedMessage[]>();
const processing = new Set<string>();
const flaggedUntil = new Map<string, number>();

client.on(Events.MessageCreate, async (message) => {
  if (!message.inGuild() || message.author.bot) return;

  const images = message.attachments.filter(
    (attachment) =>
      attachment.contentType?.startsWith("image/") ||
      /\.(png|jpe?g|gif|webp)$/i.test(attachment.name ?? "")
  );

  if (images.size < MIN_IMAGES) return;

  const key = `${message.guildId}:${message.author.id}`;
  const now = Date.now();

  // Immediately delete additional matching messages
  // after the user has triggered detection.
  if ((flaggedUntil.get(key) ?? 0) > now) {
    await message.delete().catch(console.error);
    return;
  }

  flaggedUntil.delete(key);

  const recent = (activity.get(key) ?? []).filter(
    ({ timestamp }) => now - timestamp <= WINDOW_MS
  );

  recent.push({ message, timestamp: now });
  activity.set(key, recent);

  const distinctChannels = new Set(
    recent.map(({ message }) => message.channelId)
  ).size;

  if (
    recent.length < MIN_MESSAGES ||
    distinctChannels < MIN_CHANNELS ||
    processing.has(key)
  ) {
    return;
  }

  processing.add(key);
  flaggedUntil.set(key, now + DETECTION_COOLDOWN_MS);

  console.warn("🚨 Cross-channel image spam detected", {
    userId: message.author.id,
    guildId: message.guildId,
    messages: recent.length,
    channels: distinctChannels
  });

  try {
    // Timeout user for one hour.
    try {
      const member = await message.guild.members.fetch(
        message.author.id
      );

      if (member.moderatable) {
        await member.timeout(
          TIMEOUT_MS,
          "Automatic moderation: cross-channel image spam"
        );

        console.log(
          `🔇 Timed out ${message.author.tag} for 1 hour`
        );
      } else {
        console.warn(
          `Cannot timeout ${message.author.id}: insufficient permissions or role hierarchy`
        );
      }
    } catch (error) {
      console.error("Failed to timeout user:", error);
    }

    // Delete all matching messages in the detection window.
    const results = await Promise.allSettled(
      recent.map(async ({ message: spamMessage }) => {
        await spamMessage.delete();

        console.log(
          `🗑️ Deleted ${spamMessage.id} from ${spamMessage.channelId}`
        );
      })
    );

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(
          `Failed to delete ${recent[index].message.id}:`,
          result.reason
        );
      }
    });
  } finally {
    activity.delete(key);
    processing.delete(key);
  }
});
