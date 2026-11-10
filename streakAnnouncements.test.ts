import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mock, setSystemTime, spyOn, test } from "bun:test";
import { TextChannel } from "discord.js";

test("missed daily announcements wait for catch-up, persist their day, and survive restarts", async () => {
    setSystemTime(new Date("2026-11-10T00:01:00Z"));
    const guildId = "1216816878937313442";
    const history = { lastUpdated: {}, users: {} };
    let finishCatchUp = () => {};
    const catchingUp = new Promise<void>(resolve => { finishCatchUp = resolve; });
    const send = mock(async () => {});
    const channel = Object.assign(Object.create(TextChannel.prototype), {
        id: "announcements", name: "streaks", guildId, send,
    });
    const client = Object.assign(new EventEmitter(), { channels: { fetch: async () => channel } });
    const dataContent = {
        streakAnnouncementChannelId: channel.id,
        lastStreakAnnouncementDay: "2026-11-08",
    };
    const savedDays: string[] = [];
    const saveData = mock(async () => { savedDays.push(dataContent.lastStreakAnnouncementDay); });
    const timers = new Map<number, { callback: () => Promise<void>; delay: number }>();
    let timerId = 0;
    const timeout = spyOn(globalThis, "setTimeout").mockImplementation(((callback, delay) => {
        const id = ++timerId;
        timers.set(id, { callback, delay });
        return id;
    }) as typeof setTimeout);
    const clear = spyOn(globalThis, "clearTimeout").mockImplementation(((id: number) => {
        timers.delete(id);
    }) as typeof clearTimeout);
    const errors = spyOn(console, "error").mockImplementation(() => {});
    mock.module("./client.ts", () => ({ default: client }));
    mock.module("./dataMsg.ts", () => ({ dataContent, saveData }));
    mock.module("./streaksDiscord.ts", () => ({ isStreakStorageMessage: () => false }));
    mock.module("./streaksData.ts", () => ({
        streaksGuildId: guildId,
        loadStreakHistory: async () => ({ history }),
        catchUpStreakHistory: async () => catchingUp,
        addStreakMessage: () => false,
        serializeStreakHistory: () => JSON.stringify(history),
        saveStreakHistory: async () => {},
    }));

    try {
        const streaks = await import("./streaks.ts");
        await streaks.waitForStreakHistory();
        const announcementsUrl = new URL("./streakAnnouncements.ts", import.meta.url).href;
        await import(announcementsUrl);
        await Bun.sleep(0);
        assert.equal(send.mock.calls.length, 0, "Loaded history must not bypass catch-up.");
        assert.equal(timers.size, 0);

        finishCatchUp();
        await Bun.sleep(0);
        assert.equal(send.mock.calls.length, 1);
        assert.deepEqual(savedDays, ["2026-11-09"]);
        assert.equal(timers.size, 1);
        assert.equal([...timers.values()][0]!.delay, 86_340_000);

        timers.clear();
        delete require.cache[require.resolve("./streakAnnouncements.ts")];
        await import(announcementsUrl);
        await Bun.sleep(0);
        assert.equal(send.mock.calls.length, 1, "A restart must not repeat an announced day.");
        assert.equal(saveData.mock.calls.length, 1);

        setSystemTime(new Date("2026-11-11T00:00:00Z"));
        const midnightTimers = [...timers.values()];
        timers.clear();
        await Promise.all(midnightTimers.map(timer => timer.callback()));
        assert.equal(send.mock.calls.length, 2, "Midnight uses the same persisted-day check.");
        assert.deepEqual(savedDays, ["2026-11-09", "2026-11-10"]);

        setSystemTime(new Date("2026-11-12T00:01:00Z"));
        send.mockRejectedValueOnce(new Error("Discord unavailable"));
        timers.clear();
        delete require.cache[require.resolve("./streakAnnouncements.ts")];
        await import(announcementsUrl);
        await Bun.sleep(0);
        assert.equal(dataContent.lastStreakAnnouncementDay, "2026-11-10");
        assert.equal(saveData.mock.calls.length, 2, "Failed sends must not advance the saved day.");
        assert.equal(errors.mock.calls.length, 1);

        timers.clear();
        delete require.cache[require.resolve("./streakAnnouncements.ts")];
        await import(announcementsUrl);
        await Bun.sleep(0);
        assert.deepEqual(savedDays, ["2026-11-09", "2026-11-10", "2026-11-11"]);
        assert.equal(send.mock.calls.length, 4);
    } finally {
        finishCatchUp();
        await Bun.sleep(0);
        timeout.mockRestore();
        clear.mockRestore();
        errors.mockRestore();
        setSystemTime();
    }
});
