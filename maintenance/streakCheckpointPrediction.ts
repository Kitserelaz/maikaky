import type { Client } from "discord.js";
import { streaksGuildId, type StreakHistory } from "../streaksData.ts";

export type GlobalStreakHistory = Omit<StreakHistory, "lastUpdated"> & {
    lastUpdated: string | null;
};

export const predictStreakCheckpoints = async (client: Client, history: GlobalStreakHistory) => {
    const timestampsByUser = new Map(Object.entries(history.users).map(([id, user]) => [
        id,
        new Set(Object.values(user.days).flatMap(day => day.timestamps)),
    ]));
    const guild = await client.guilds.fetch(streaksGuildId);
    const channels = await guild.channels.fetch();
    const lastUpdated: Record<string, string> = {};
    const globalCheckpoint = BigInt(history.lastUpdated ?? "0");

    for (const channel of channels.values()) {
        if (!channel?.isTextBased()) continue;
        let before = (globalCheckpoint + 1n).toString();
        let checkpoint = 0n;
        let fetched = 0;
        console.log(`[streaks] Predicting checkpoint for #${channel.name} (${channel.id}).`);

        while (globalCheckpoint > 0n) {
            const batch = await channel.messages.fetch({ limit: 100, before, cache: false });
            fetched += batch.size;
            console.log(`[streaks] #${channel.name}: checked ${fetched} messages for a saved author/timestamp match.`);
            if (batch.size === 0) break;
            let oldest = BigInt(before);

            for (const message of batch.values()) {
                const id = BigInt(message.id);
                if (id < oldest) oldest = id;
                if (message.author.bot) continue;
                const timestamp = new Date(message.createdTimestamp).toISOString();
                if (timestampsByUser.get(message.author.id)?.has(timestamp) && id > checkpoint) checkpoint = id;
            }

            if (checkpoint > 0n || batch.size < 100) break;
            before = oldest.toString();
        }

        lastUpdated[channel.id] = checkpoint.toString();
        console.log(`[streaks] #${channel.name}: estimated checkpoint=${checkpoint}${checkpoint === 0n ? " (no match; startup will fetch this channel's history)" : ""}.`);
    }

    return { lastUpdated, users: history.users };
};
