import assert from "node:assert/strict";
import { test } from "bun:test";
import type { Express, Request, Response } from "express";
import { createStatsReader, registerStatsEndpoint } from "./stats.ts";
import type { LurkrUserLevelResponse } from "./lurkr.ts";
import type { StreakHistory } from "./streaksData.ts";

const userId = "123456789012345678";

test("stats endpoint protects live stats and distinguishes missing data from an outage", async () => {
    let handler!: (req: Request, res: Response) => Promise<void>;
    const app = { get: (_path: string, callback: typeof handler) => { handler = callback; } } as unknown as Express;
    let history: StreakHistory | undefined;
    let levelStatus = 404;
    let levelRequests = 0;
    const getStats = createStatsReader({
        getHistory: () => history,
        getLevel: async id => {
            assert.equal(id, userId);
            levelRequests++;
            if (levelStatus !== 200) throw Object.assign(new Error("Lurkr unavailable"), { status: levelStatus });
            return { level: { level: 24 } } as LurkrUserLevelResponse;
        },
    });
    registerStatsEndpoint(app, "test-token", getStats);

    const request = async (authorization = "Bearer test-token", id = userId) => {
        let status = 200;
        let body: unknown;
        const headers = new Map();
        const response = {
            set: (name: string, value: string) => { headers.set(name, value); },
            status: (code: number) => { status = code; return response; },
            json: (value: unknown) => { body = value; },
        };
        await handler({ get: () => authorization, params: { userId: id } } as unknown as Request, response as unknown as Response);
        assert.equal(headers.get("Cache-Control"), "no-store");
        return { status, body };
    };

    assert.equal((await request("Bearer fake-token")).status, 401);
    assert.equal((await request(undefined, "18446744073709551616")).status, 400);
    assert.equal((await request()).status, 503);
    assert.equal(levelRequests, 0);

    history = { lastUpdated: {}, users: {} };
    assert.deepEqual(await request(), { status: 200, body: { currentStreak: 0, longestStreak: 0, level: 0 } });
    history.users[userId] = {
        name: "member",
        days: {
            "2025-01-01": { count: 1, timestamps: ["2025-01-01T12:00:00Z"] },
            "2025-01-02": { count: 1, timestamps: ["2025-01-02T12:00:00Z"] },
        },
    };
    levelStatus = 200;
    assert.deepEqual(await request(), { status: 200, body: { currentStreak: 0, longestStreak: 2, level: 24 } });
    levelStatus = 429;
    assert.equal((await request()).status, 503);
});
