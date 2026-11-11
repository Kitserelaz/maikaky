import express from "express";
import { createLurkr } from "./lurkr.ts";
import { streaksGuildId, type StreakHistory } from "./streaksData.ts";
import { createStatsReader, registerStatsEndpoint } from "./stats.ts";
import { registerStatsEvents } from "./statsEvents.ts";

const apiKey = process.env.LURKR_API_KEY;
if (!apiKey?.trim()) throw new Error("LURKR_API_KEY is required.");
const lurkr = createLurkr(apiKey);
let readStreakHistory: (() => StreakHistory | undefined) | undefined;
const getStats = createStatsReader({
    getHistory: () => readStreakHistory?.(),
    getLevel: userId => lurkr.getUserLevel(streaksGuildId, userId),
});
const app = express();
app.get("/", (_req, res) => res.send("Hello World!"));
const statsToken = process.env.STATS_API_TOKEN ?? "";
registerStatsEndpoint(app, statsToken, getStats);
const port = Number(process.env.PORT ?? "3000");
const server = app.listen(port, "0.0.0.0", () => console.log(`Maikaky stats listening on port ${port}`));
const publishStreakChange = registerStatsEvents(server, statsToken);

// Streak tracking imports the Discord client, so load it after binding the HTTP port.
const { getStreakHistory, streakEvents } = await import("./streaks.ts");
readStreakHistory = getStreakHistory;
streakEvents.on("change", publishStreakChange);
