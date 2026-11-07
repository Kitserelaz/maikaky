import type { TextBasedChannel } from "discord.js";
import client from "../client.ts";
import { calculateStreak, streakTimeout } from "./messageStreakCalculations.ts";

const guildId = "1216816878937313442";
const messageLimit = 300;

type AuthorState = {
    name: string;
    timestamps: Set<number>;
    channels: Set<string>;
};

type ChannelState = {
    channel: TextBasedChannel;
    name: string;
    before?: string;
    oldestMessageAt?: number;
    exhausted: boolean;
};

const guild = await client.guilds.fetch(guildId);
const channelStates: ChannelState[] = [...(await guild.channels.fetch()).values()]
    .flatMap(channel => channel && channel.isTextBased()
        ? [{ channel, name: channel.name, exhausted: false }]
        : []);
const channelsById = new Map(channelStates.map(state => [state.channel.id, state]));
const authors = new Map<string, AuthorState>();

const fetchMessages = async (state: ChannelState) => {
    let fetched = 0;

    try {
        while (fetched < messageLimit) {
            const limit = Math.min(100, messageLimit - fetched);
            const batch = await state.channel.messages.fetch(state.before ? { limit, before: state.before } : { limit });
            if (batch.size === 0) {
                state.exhausted = true;
                break;
            }

            for (const message of batch.values()) {
                state.oldestMessageAt = Math.min(state.oldestMessageAt ?? Infinity, message.createdTimestamp);
                if (message.author.bot) continue;

                const author = authors.get(message.author.id) ?? {
                    name: message.author.tag,
                    timestamps: new Set<number>(),
                    channels: new Set<string>(),
                };
                author.timestamps.add(message.createdTimestamp);
                author.channels.add(state.channel.id);
                authors.set(message.author.id, author);
            }

            fetched += batch.size;
            state.before = batch.last()?.id;

            if (batch.size < limit) {
                state.exhausted = true;
                break;
            }
        }
    } catch (error) {
        console.warn(`Skipped #${state.name}: ${error}`);
        state.exhausted = true;
    }

    return fetched;
};

const streakReachesWindowEdge = () => {
    for (const author of authors.values()) {
        const { startTimestamp } = calculateStreak(author.timestamps);

        for (const channelId of author.channels) {
            const state = channelsById.get(channelId);
            if (!state || state.exhausted || state.oldestMessageAt === undefined) continue;
            if (state.oldestMessageAt > startTimestamp - streakTimeout) return true;
        }
    }

    return false;
};

let round = 0;

while (true) {
    const pending = channelStates.filter(state => !state.exhausted);
    if (pending.length === 0) break;

    round++;
    console.log(`\nRound ${round}`);

    for (const [index, state] of pending.entries()) {
        const progress = `[${index + 1}/${pending.length}]`;
        console.log(`${progress} Reading #${state.name}...`);
        const fetched = await fetchMessages(state);
        console.log(`${progress} #${state.name}: ${fetched} message(s)${state.exhausted ? " (start of channel)" : ""}.`);
    }

    if (!streakReachesWindowEdge()) break;
    console.log("A current streak reaches the window edge; continuing with another round.");
}

const rows = [...authors.values()]
    .map(({ name, timestamps }) => {
        const { current, longest, lastDay } = calculateStreak(timestamps);
        return { user: name, current, longest, lastDay };
    })
    .sort((a, b) => b.longest - a.longest || b.current - a.current || a.user.localeCompare(b.user));

console.log(`\nFinished after ${round} round(s).`);
console.log(`${rows.length} user(s) chatted within the fetched messages.\n`);
console.table(rows);

await client.destroy();
