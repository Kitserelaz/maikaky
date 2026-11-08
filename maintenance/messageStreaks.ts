import client from "../client.ts";
import { catchUpStreakHistory, loadStreakHistory, saveStreakHistory, serializeStreakHistory } from "../streaksData.ts";
import { calculateStreak } from "./messageStreakCalculations.ts";

try {
    const store = await loadStreakHistory();
    await catchUpStreakHistory(client, store);
    await saveStreakHistory(serializeStreakHistory(store.history));
    console.log("Wrote message history to streaks.json.");

    const rows = Object.values(store.history.users)
        .map(({ name, days }) => {
            const timestamps = new Set(Object.values(days).flatMap(day =>
                day.timestamps.map(timestamp => Date.parse(timestamp))));
            const { current, longest, lastDay } = calculateStreak(timestamps);
            return { user: name, current, longest, lastDay };
        })
        .sort((a, b) => b.longest - a.longest || b.current - a.current || a.user.localeCompare(b.user));

    console.log(`${rows.length} user(s) chatted within the fetched messages.`);
    console.table(rows);
} finally {
    await client.destroy();
}
