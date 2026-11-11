import { timingSafeEqual } from "node:crypto";
import type { Express } from "express";
import { calculateUserStreak } from "./maintenance/messageStreakCalculations.ts";
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
    const streak = calculateUserStreak(history.users[userId]?.days);
    let level = 0;
    try {
        level = (await getLevel(userId)).level.level;
    } catch (error) {
        if (!(error instanceof Error && "status" in error && error.status === 404)) throw error;
    }
    return { currentStreak: streak.current, longestStreak: streak.longest, level };
};

export const createStatsAuthorizer = (token: string) => {
    if (!token.trim()) throw new Error("STATS_API_TOKEN is required.");
    const expected = Buffer.from(`Bearer ${token}`);
    return (header: string | undefined) => {
        const authorization = Buffer.from(header ?? "");
        return authorization.length === expected.length && timingSafeEqual(authorization, expected);
    };
};

export const registerStatsEndpoint = (app: Express, token: string, getStats: (userId: string) => Promise<Stats>) => {
    const isAuthorized = createStatsAuthorizer(token);
    app.get("/internal/stats/:userId", async (req, res) => {
        res.set("Cache-Control", "no-store");
        if (!isAuthorized(req.get("Authorization"))) {
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
