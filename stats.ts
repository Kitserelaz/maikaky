import { timingSafeEqual } from "node:crypto";
import type { Express } from "express";
import { calculateStreak } from "./maintenance/messageStreakCalculations.ts";
import type { StreakHistory } from "./streaksData.ts";
import type { LurkrUserLevelResponse } from "./lurkr.ts";

type Stats = { currentStreak: number; longestStreak: number; level: number };

type StatsDependencies = {
    getHistory: () => StreakHistory | undefined;
    getLevel: (userId: string) => Promise<LurkrUserLevelResponse>;
};

export const createStatsReader = ({ getHistory, getLevel }: StatsDependencies) => async (userId: string): Promise<Stats> => {
    const history = getHistory();
    if (!history) throw new Error("Streak history is not loaded.");
    const days = history.users[userId]?.days;
    const timestamps = new Set(Object.values(days ?? {}).flatMap(day =>
        day.timestamps.map(timestamp => Date.parse(timestamp))));
    const streak = timestamps.size > 0 ? calculateStreak(timestamps) : { current: 0, longest: 0 };
    let level = 0;
    try {
        level = (await getLevel(userId)).level.level;
    } catch (error) {
        if (!(error instanceof Error && "status" in error && error.status === 404)) throw error;
    }
    return { currentStreak: streak.current, longestStreak: streak.longest, level };
};

export const registerStatsEndpoint = (app: Express, token: string, getStats: (userId: string) => Promise<Stats>) => {
    if (!token.trim()) throw new Error("STATS_API_TOKEN is required.");
    const expected = Buffer.from(`Bearer ${token}`);
    app.get("/internal/stats/:userId", async (req, res) => {
        res.set("Cache-Control", "no-store");
        const authorization = Buffer.from(req.get("Authorization") ?? "");
        if (authorization.length !== expected.length || !timingSafeEqual(authorization, expected)) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        const userId = req.params.userId;
        if (typeof userId !== "string" || !/^[1-9]\d{16,19}$/.test(userId) || BigInt(userId) > 18446744073709551615n) {
            res.status(400).json({ error: "Invalid user ID" });
            return;
        }
        try {
            res.json(await getStats(userId));
        } catch {
            console.error("[Stats API] Could not retrieve user stats.");
            res.status(503).json({ error: "Stats unavailable" });
        }
    });
};
