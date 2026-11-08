import { Events, type Message } from "discord.js";
import client from "./client.ts";
import { isStreakStorageMessage } from "./streaksDiscord.ts";
import {
    addStreakMessage,
    catchUpStreakHistory,
    loadStreakHistory,
    saveStreakHistory,
    serializeStreakHistory,
    streaksGuildId,
    type StreakHistory,
    type StreakStore,
} from "./streaksData.ts";

const saveInterval = 5_000;
const bufferedMessages = new Map<string, Message>();
let store: StreakStore | undefined;
let ready = false;
let dirty = false;
let writing = false;
let lastSavedAt = 0;
let retrySaveAfter = 0;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let catchingUp = false;
let catchUpRequested = false;
let catchUpTimer: ReturnType<typeof setTimeout> | undefined;

let resolveStreakHistory!: (history: StreakHistory) => void;
const loadedStreakHistory = new Promise<StreakHistory>(resolve => {
    resolveStreakHistory = resolve;
});

export const getStreakHistory = () => store?.history;
export const waitForStreakHistory = () => loadedStreakHistory;

const scheduleSave = () => {
    if (!ready || !dirty || writing || saveTimer !== undefined) return;
    const delay = Math.max(0, lastSavedAt + saveInterval - Date.now(), retrySaveAfter - Date.now());
    if (delay === 0) {
        void flush();
        return;
    }
    console.log(`[streaks] Scheduling save in ${delay}ms.`);
    saveTimer = setTimeout(() => {
        saveTimer = undefined;
        void flush();
    }, delay);
};

const flush = async () => {
    if (!store || !ready || !dirty || writing) return;
    writing = true;
    dirty = false;
    try {
        const snapshot = serializeStreakHistory(store.history);
        await saveStreakHistory(snapshot);
        lastSavedAt = Date.now();
        retrySaveAfter = 0;
        if (dirty) console.log("[streaks] Messages arrived during the save; another save is pending.");
    } catch (error) {
        console.error("Failed to save streaks.json:", error);
        dirty = true;
        retrySaveAfter = Date.now() + saveInterval;
    } finally {
        writing = false;
        scheduleSave();
    }
};

const catchUp = async () => {
    if (catchingUp) return;
    catchingUp = true;
    console.log(`[streaks] ${ready ? "Reconnecting" : "Initializing"}; starting catch-up.`);
    try {
        store ??= await loadStreakHistory();
        resolveStreakHistory(store.history);
        do {
            catchUpRequested = false;
            await catchUpStreakHistory(client, store);
        } while (catchUpRequested);

        console.log(`[streaks] Merging ${bufferedMessages.size} buffered live messages.`);
        for (const message of bufferedMessages.values()) addStreakMessage(store, message);
        bufferedMessages.clear();
        ready = true;
        dirty = true;
        console.log("[streaks] Live tracking is ready.");
    } catch (error) {
        console.error("Streak tracking will retry catch-up in five seconds:", error);
        if (ready) dirty = true;
        catchUpTimer = setTimeout(() => {
            catchUpTimer = undefined;
            void catchUp();
        }, saveInterval);
    } finally {
        catchingUp = false;
        scheduleSave();
    }
};

const requestCatchUp = () => {
    catchUpRequested = true;
    console.log(`[streaks] Catch-up requested${catchingUp || catchUpTimer !== undefined ? "; queued behind the current catch-up or retry" : ""}.`);
    if (!catchingUp && catchUpTimer === undefined) void catchUp();
};

client.on(Events.MessageCreate, message => {
    if (message.guildId !== streaksGuildId || message.channel.isThread() || isStreakStorageMessage(message)) return;
    if (!ready || !store) {
        bufferedMessages.set(message.id, message);
        console.log(`[streaks] Buffered message ${message.id} in channel ${message.channelId}; ${bufferedMessages.size} buffered messages.`);
        return;
    }
    const changed = addStreakMessage(store, message);
    console.log(`[streaks] Live message ${message.id} from ${message.author.tag} in channel ${message.channelId}: ${changed ? "history updated" : "no history changes (bot or duplicate)"}.`);
    if (changed) {
        dirty = true;
        scheduleSave();
    }
});

client.on(Events.ShardReady, requestCatchUp);
client.on(Events.ShardResume, requestCatchUp);
requestCatchUp();
