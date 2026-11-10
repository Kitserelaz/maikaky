import client from "../client.ts";

const guildId = "1216816878937313442";
const channelId = "1565244275581521960";

try {
    const guild = await client.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(channelId);
    if (!channel) throw new Error(`Channel ${channelId} not found`);

    console.log(`Channel: ${channel.name} (${channel.id}), category: ${channel.parentId ?? "none"}`);
    let before: string | undefined;

    do {
        const logs = await guild.fetchAuditLogs({ limit: 100, before });
        for (const entry of logs.entries.values()) {
            if (entry.targetId !== channelId && entry.targetId !== channel.parentId) continue;

            const output = JSON.stringify({
                time: entry.createdAt.toISOString(),
                action: entry.action,
                targetId: entry.targetId,
                executor: entry.executor?.tag ?? entry.executorId,
                reason: entry.reason,
                changes: entry.changes,
                extra: entry.extra && "id" in entry.extra ? { id: entry.extra.id } : null,
            });
            console.log(process.env.token ? output.replaceAll(process.env.token, "[REDACTED]") : output);
        }
        before = logs.entries.size === 100 ? logs.entries.last()?.id : undefined;
    } while (before);
} finally {
    await client.destroy();
}
