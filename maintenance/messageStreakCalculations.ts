export const streakTimeout = 48 * 60 * 60 * 1000;

const dayInMilliseconds = 86_400_000;

const streakDeadline = (timestamp: number) =>
    (Math.floor(timestamp / dayInMilliseconds) + 1) * dayInMilliseconds + streakTimeout;

export const calculateStreak = (timestamps: Set<number>) => {
    const sorted = [...timestamps].sort((a, b) => a - b);
    let longest = 1;
    let current = 1;
    let startTimestamp = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] >= streakDeadline(sorted[i - 1])) {
            current = 1;
            startTimestamp = sorted[i];
        } else if (Math.floor(sorted[i] / dayInMilliseconds) !== Math.floor(sorted[i - 1] / dayInMilliseconds)) {
            current++;
        }
        longest = Math.max(longest, current);
    }

    const lastTimestamp = sorted.at(-1)!;
    const now = Date.now();
    if (now >= streakDeadline(lastTimestamp)) current = 0;
    const status = current === 0 ? "ended"
        : now < streakDeadline(lastTimestamp) - streakTimeout ? "active"
        : now >= streakDeadline(lastTimestamp) - dayInMilliseconds ? "warning" : "grace";
    const lastDay = new Date(lastTimestamp).toISOString().slice(0, 10);
    return { current, longest, startTimestamp, lastDay, status };
};
