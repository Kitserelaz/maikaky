import express from "express";
import { createLurkr } from "./lurkr.ts";
import { getStreakHistory, streakEvents } from "./streaks.ts";
import { streaksGuildId } from "./streaksData.ts";
import { createStatsReader, registerStatsEndpoint } from "./stats.ts";
import { registerStatsEvents } from "./statsEvents.ts";

const apiKey = process.env.LURKR_API_KEY;
if (!apiKey?.trim()) throw new Error("LURKR_API_KEY is required.");
const lurkr = createLurkr(apiKey);
const getStats = createStatsReader({
    getHistory: getStreakHistory,
    getLevel: userId => lurkr.getUserLevel(streaksGuildId, userId),
});
const app = express();
app.get("/", (_req, res) => res.send("Hello World!"));
const statsToken = process.env.STATS_API_TOKEN ?? "";
registerStatsEndpoint(app, statsToken, getStats);
const server = app.listen(3000, () => console.log("Maikaky stats listening on port 3000"));
streakEvents.on("change", registerStatsEvents(server, statsToken));
