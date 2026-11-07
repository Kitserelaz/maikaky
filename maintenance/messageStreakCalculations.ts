export const streakTimeout = 36 * 60 * 60 * 1000;

const dayInMilliseconds = 86_400_000;

export const calculateStreak = (timestamps: Set<number>) => {
    const sorted = [...timestamps].sort((a, b) => a - b);
    let longest = 1;
    let current = 1;
    let startTimestamp = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] - sorted[i - 1] >= streakTimeout) {
            current = 1;
            startTimestamp = sorted[i];
        } else if (Math.floor(sorted[i] / dayInMilliseconds) !== Math.floor(sorted[i - 1] / dayInMilliseconds)) {
            current++;
        }
        longest = Math.max(longest, current);
    }

    const lastTimestamp = sorted.at(-1)!;
    if (Date.now() - lastTimestamp >= streakTimeout) current = 0;
    const lastDay = new Date(lastTimestamp).toISOString().slice(0, 10);
    return { current, longest, startTimestamp, lastDay };
};
