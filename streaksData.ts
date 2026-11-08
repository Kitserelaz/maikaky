import type { Client, Message } from "discord.js";
import { rename, writeFile } from "node:fs/promises";
import { isStreakStorageMessage, loadDiscordStreakSnapshot, saveDiscordStreakSnapshot } from "./streaksDiscord.ts";

export const streaksGuildId = "1216816878937313442";

type StreakDay = {
    count: number;
    timestamps: string[];
};

type StreakUser = {
    name: string;
    days: Record<string, StreakDay>;
};

export type StreakHistory = {
    lastUpdated: Record<string, string>;
    users: Record<string, StreakUser>;
};

export type StreakStore = {
    history: StreakHistory;
    messageIds: Set<string>;
    resumeAfter: Record<string, string>;
    checkpoints: Map<string, bigint>;
};

const saveLocalStreakSnapshot = async (snapshot: string) => {
    await writeFile("streaks.json.tmp", snapshot, "utf8");
    await rename("streaks.json.tmp", "streaks.json");
};

export const loadStreakHistory = async (): Promise<StreakStore> => {
    console.log("[streaks] Loading streak history from Discord...");
    const snapshot = await loadDiscordStreakSnapshot();
    const history: StreakHistory = JSON.parse(snapshot);
    await saveLocalStreakSnapshot(snapshot);

    console.log(`[streaks] Loaded ${Object.keys(history.users).length} users and ${Object.keys(history.lastUpdated).length} channel checkpoints.`);
    return {
        history,
        messageIds: new Set(),
        resumeAfter: { ...history.lastUpdated },
        checkpoints: new Map(),
    };
};

export const addStreakMessage = (store: StreakStore, message: Message) => {
    if (message.guildId !== streaksGuildId || message.channel.isThread() || isStreakStorageMessage(message)) return false;

    const { history, messageIds } = store;
    if (BigInt(message.id) <= BigInt(store.resumeAfter[message.channelId] ?? "0")) return false;
    let changed = false;
    if (BigInt(message.id) > BigInt(history.lastUpdated[message.channelId] ?? "0")) {
        history.lastUpdated[message.channelId] = message.id;
        changed = true;
    }
    if (message.author.bot || messageIds.has(message.id)) return changed;

    const user: StreakUser = history.users[message.author.id] ??= { name: message.author.tag, days: {} };
    const timestamp = new Date(message.createdTimestamp).toISOString();
    const day: StreakDay = user.days[timestamp.slice(0, 10)] ??= { count: 0, timestamps: [] };
    day.timestamps.push(timestamp);
    day.count = day.timestamps.length;
    messageIds.add(message.id);
    return true;
};

export const catchUpStreakHistory = async (client: Client, store: StreakStore) => {
    const guild = await client.guilds.fetch(streaksGuildId);
    const channels = await guild.channels.fetch();
    const textChannels = [...channels.values()].flatMap(channel => channel?.isTextBased() ? [channel] : []);
    const failures: unknown[] = [];
    let completed = 0;
    console.log(`[streaks] ${textChannels.length === 0 ? "100.0" : "0.0"}% (${completed}/${textChannels.length} channels complete): starting catch-up in ${guild.name}.`);

    for (const channel of textChannels) {
        const progress = `${(completed / textChannels.length * 100).toFixed(1)}% (${completed}/${textChannels.length} channels complete)`;
        const cutoff = store.checkpoints.get(channel.id) ?? BigInt(store.resumeAfter[channel.id] ?? "0");
        let newest = cutoff;
        let before: string | undefined;
        let fetched = 0;
        console.log(`[streaks] ${progress}: reading #${channel.name} (${channel.id}); checkpoint=${cutoff}.`);

        try {
            while (true) {
                const batch = await channel.messages.fetch({ limit: 100, before, cache: false });
                fetched += batch.size;
                console.log(`[streaks] ${progress}: #${channel.name}: fetched ${batch.size} messages (${fetched} total); before=${before ?? "latest"}.`);
                if (batch.size === 0) break;
                let reachedCheckpoint = false;
                let oldest: string | undefined;

                for (const message of batch.values()) {
                    const id = BigInt(message.id);
                    if (oldest === undefined || id < BigInt(oldest)) oldest = message.id;
                    if (isStreakStorageMessage(message)) continue;
                    if (id > newest) newest = id;
                    if (id <= cutoff) {
                        reachedCheckpoint = true;
                        continue;
                    }
                    addStreakMessage(store, message);
                }

                if (reachedCheckpoint || batch.size < 100) break;
                before = oldest;
            }

            store.checkpoints.set(channel.id, newest);
            completed++;
            console.log(`[streaks] ${(completed / textChannels.length * 100).toFixed(1)}% (${completed}/${textChannels.length} channels complete): #${channel.name} caught up; checkpoint=${newest}.`);
        } catch (error) {
            console.error(`Streak catch-up failed in #${channel.name}:`, error);
            failures.push(error);
        }
    }

    if (failures.length > 0) throw new AggregateError(failures, "Streak catch-up is incomplete.");
    console.log(`[streaks] Catch-up complete; ${store.messageIds.size} messages added this session; ${Object.keys(store.history.lastUpdated).length} channel checkpoints.`);
};

export const serializeStreakHistory = (history: StreakHistory) => {
    const users = Object.fromEntries(Object.entries(history.users).map(([id, user]) => [id, {
        name: user.name,
        days: Object.fromEntries(Object.entries(user.days).sort(([a], [b]) => a.localeCompare(b)).map(([day, data]) => [day, {
            count: data.timestamps.length,
            timestamps: [...data.timestamps].sort(),
        }])),
    }]));
    return JSON.stringify({ lastUpdated: history.lastUpdated, users });
};

export const saveStreakHistory = async (snapshot: string) => {
    // The bot and maintenance script must not run as simultaneous writers.
    console.log(`[streaks] Writing streaks.json.tmp (${snapshot.length} characters)...`);
    await saveLocalStreakSnapshot(snapshot);
    await saveDiscordStreakSnapshot(snapshot);
    console.log("[streaks] Saved streak history locally and to Discord successfully.");
};
