import client from "../client.ts";

const guildId = "1216816878937313442";

type ChannelActivity = {
    name: string;
    lastMessageAt: number | null;
};

const guild = await client.guilds.fetch(guildId);
const channels = [...(await guild.channels.fetch()).values()]
    .flatMap(channel => channel && channel.isTextBased() ? [channel] : []);

const activity: ChannelActivity[] = [];

for (const [index, channel] of channels.entries()) {
    const progress = `[${index + 1}/${channels.length}]`;

    try {
        const [message] = [...(await channel.messages.fetch({ limit: 1 })).values()];
        activity.push({ name: channel.name, lastMessageAt: message?.createdTimestamp ?? null });
        console.log(`${progress} #${channel.name}: ${message ? new Date(message.createdTimestamp).toISOString() : "no messages"}`);
    } catch (error) {
        console.warn(`${progress} Skipped #${channel.name}: ${error}`);
    }
}

const firstYear = Math.min(...channels.map(channel => channel.createdAt.getUTCFullYear()));
const lastYear = new Date().getUTCFullYear() - 1;

const rows: { since: string; silent: number; channels: number }[] = [];

for (let year = lastYear; year >= firstYear; year--) {
    const cutoff = Date.UTC(year + 1, 0, 1);
    rows.push({
        since: `end of ${year}`,
        silent: activity.filter(({ lastMessageAt }) => lastMessageAt === null || lastMessageAt < cutoff).length,
        channels: activity.length,
    });
}

console.log(`\n${activity.length} readable channel(s) of ${channels.length} in ${guild.name}.`);
console.table(rows);

await client.destroy();
