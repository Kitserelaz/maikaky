import { DiscordAPIError, Events, TextChannel } from "discord.js";
import client from "./client.ts";
import { createLurkr } from "./lurkr.ts";
import type { LurkrUserLevelResponse } from "./lurkr.ts";

const channelId = "1275812346648072336";
const authorId = "506186003816513538";
const excludedRoleId = "1339492338220929074";
const apiKey = process.env.LURKR_API_KEY;
const lurkr = createLurkr(apiKey!);
const memberIds = new Set<string>();

export const leaderboardData = {
    guildId: null as string | null,
    status: "loading" as "loading" | "ready" | "failed",
    levels: new Map<string, LurkrUserLevelResponse>(),
    failedUserIds: new Set<string>()
};

const refreshUser = async (userId: string) => {
    try {
        const guild = await client.guilds.fetch(leaderboardData.guildId!);
        const member = await guild.members.fetch({ user: userId, force: true });
        if (member.roles.cache.has(excludedRoleId)) {
            leaderboardData.levels.delete(userId);
            leaderboardData.failedUserIds.delete(userId);
            console.log(`[Leaderboard] Skipped ${userId}: has excluded role ${excludedRoleId}.`);
            return;
        }

        const level = await lurkr.getUserLevel(leaderboardData.guildId!, userId);
        leaderboardData.levels.set(userId, level);
        leaderboardData.failedUserIds.delete(userId);
        console.log(`[Leaderboard] Refreshed ${userId}: level ${level.level.level}, XP ${level.level.xp}.`);
    } catch (error) {
        if (error instanceof DiscordAPIError && error.code === 10007) {
            leaderboardData.levels.delete(userId);
            leaderboardData.failedUserIds.delete(userId);
            console.log(`[Leaderboard] Skipped ${userId}: no longer in the server.`);
            return;
        }
        if (error instanceof Error && "status" in error && error.status === 404) {
            leaderboardData.failedUserIds.delete(userId);
        } else {
            leaderboardData.failedUserIds.add(userId);
        }
        const reason = error instanceof Error ? error.message : String(error);
        console.error(`[Leaderboard] Failed to refresh ${userId}:`, apiKey ? reason.replaceAll(apiKey, "[REDACTED]") : reason);
    }
};

const initialize = async () => {
    console.log(`[Leaderboard] Starting full history scan of channel ${channelId}.`);
    if (!apiKey?.trim()) throw new Error("LURKR_API_KEY is missing.");
    const channel = await client.channels.fetch(channelId);
    if (!(channel instanceof TextChannel)) throw new Error("Leaderboard channel must be a server text channel.");
    leaderboardData.guildId = channel.guildId;

    let before: string | undefined;
    let page = 0;
    let totalMessages = 0;
    let totalMatching = 0;

    while (true) {
        const messages = await channel.messages.fetch({ limit: 100, before });
        let matching = 0;

        for (const message of messages.values()) {
            if (message.channelId !== channelId || message.author.id !== authorId) continue;
            matching++;
            for (const userId of message.mentions.users.keys()) memberIds.add(userId);
        }

        page++;
        totalMessages += messages.size;
        totalMatching += matching;
        console.log(`[Leaderboard] Page ${page}: ${messages.size} messages, ${matching} matching, ${memberIds.size} unique users so far.`);
        if (messages.size === 0) break;
        before = [...messages.keys()].reduce((oldest, id) => BigInt(id) < BigInt(oldest) ? id : oldest);
    }

    console.log(`[Leaderboard] History complete: ${totalMessages} messages, ${totalMatching} matching, ${memberIds.size} unique users.`);
    const startupIds = [...memberIds];
    for (const [index, userId] of startupIds.entries()) {
        console.log(`[Leaderboard] Startup refresh ${index + 1}/${startupIds.length}: ${userId}.`);
        await refreshUser(userId);
    }

    leaderboardData.status = "ready";
    console.log(`[Leaderboard] Startup complete: ${startupIds.length} recorded users, ${leaderboardData.levels.size} successful fetches, ${leaderboardData.failedUserIds.size} failures.`);
};

let updates = Promise.resolve();

client.on(Events.MessageCreate, message => {
    if (message.channelId !== channelId || message.author.id !== authorId) return;
    const userIds = [...message.mentions.users.keys()];
    for (const userId of userIds) memberIds.add(userId);
    console.log(`[Leaderboard] Live message ${message.id}: ${userIds.length} mentioned users, ${memberIds.size} recorded users.`);

    updates = updates.then(async () => {
        if (leaderboardData.status !== "ready") {
            console.error(`[Leaderboard] Skipping refresh for message ${message.id}: initialization failed.`);
            return;
        }
        for (const userId of userIds) await refreshUser(userId);
    }).catch(() => {
        console.error(`[Leaderboard] Live refresh failed for message ${message.id}.`);
    });
});

updates = initialize().catch(error => {
    leaderboardData.status = "failed";
    const reason = error instanceof Error ? error.message : String(error);
    console.error("[Leaderboard] Initialization failed:", apiKey ? reason.replaceAll(apiKey, "[REDACTED]") : reason);
});
