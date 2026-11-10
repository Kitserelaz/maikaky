import assert from "node:assert/strict";
import { test } from "bun:test";
import { formatStreakLeaderboard } from "./streakLeaderboardFormatting.ts";

test("leaderboard dates count UTC days from November 8, including across year boundaries", () => {
    const history = { lastUpdated: {}, users: {} };
    for (const [date, label] of [
        ["2026-11-08", "Nov 8, 2026 (UTC) · Day 1"],
        ["2026-11-09", "Nov 9, 2026 (UTC) · Day 2"],
        ["2027-01-01", "Jan 1, 2027 (UTC) · Day 55"],
    ] as const) {
        for (const showPagination of [false, true]) {
            const output = formatStreakLeaderboard(history, 0, showPagination, date);
            assert.ok(JSON.stringify(output).includes(label));
        }
    }
});
