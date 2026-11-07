import client from "../client.ts";

const susMsgs = [
  { channelId: "1296064951814979646", messageId: "1545085965582737478" },
  { channelId: "1332771662588022876", messageId: "1545085955906736128" },
  { channelId: "1216817205497299065", messageId: "1545085947148767285" },
  { channelId: "1441321405835645090", messageId: "1545085940182286437" },
  { channelId: "1441321368867311686", messageId: "1545085933009899551" },
  { channelId: "1441321139984007208", messageId: "1545085926395482133" },
  { channelId: "1216817197893029929", messageId: "1545085917859946549" },
  { channelId: "1216817196387537066", messageId: "1545085909463203982" }
];

client.once("clientReady", async () => {
  for (const { channelId, messageId } of susMsgs) {
    try {
      const channel = await client.channels.fetch(channelId, {
        force: true
      });

      if (!channel?.isTextBased() || !("messages" in channel)) {
        console.log(`Channel ${channelId} is inaccessible`);
        continue;
      }

      const message = await channel.messages.fetch({
        message: messageId,
        force: true,
        cache: false
      });

      console.log(message.toJSON());
    } catch (error) {
      console.error(`Failed to fetch ${messageId}:`, error);
    }
  }
});
