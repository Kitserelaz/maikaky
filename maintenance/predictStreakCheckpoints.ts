import { constants } from "node:fs";
import { copyFile, readFile } from "node:fs/promises";
import client from "../client.ts";
import { saveStreakHistory, serializeStreakHistory } from "../streaksData.ts";
import { predictStreakCheckpoints, type GlobalStreakHistory } from "./streakCheckpointPrediction.ts";

// Run once with the bot stopped, against the JSON containing a global lastUpdated.
try {
    const history: GlobalStreakHistory = JSON.parse(await readFile("streaks.json", "utf8"));
    const predicted = await predictStreakCheckpoints(client, history);
    await copyFile("streaks.json", "streaks.before-channel-checkpoints.json", constants.COPYFILE_EXCL);
    await saveStreakHistory(serializeStreakHistory(predicted));
    console.log("[streaks] Saved estimated per-channel checkpoints; counts and timestamps preserved.");
    console.log("[streaks] Original history backed up to streaks.before-channel-checkpoints.json.");
} finally {
    await client.destroy();
}
