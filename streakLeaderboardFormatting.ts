import { ButtonStyle, ComponentType, MessageFlags, escapeMarkdown } from "discord.js";
import type { APIContainerComponent, APITextDisplayComponent, InteractionEditReplyOptions } from "discord.js";
import { calculateStreak } from "./maintenance/messageStreakCalculations.ts";
import type { StreakHistory } from "./streaksData.ts";

export const formatStreakLeaderboard = (
    history: StreakHistory,
    requestedPage: number,
): InteractionEditReplyOptions => {
    const entries = Object.entries(history.users)
        .map(([id, { name, days }]) => {
            const timestamps = new Set(Object.values(days).flatMap(day =>
                day.timestamps.map(timestamp => Date.parse(timestamp))));
            const { current, longest } = calculateStreak(timestamps);
            return { id, name, current, longest };
        })
        .sort((a, b) => b.current - a.current || b.longest - a.longest || a.id.localeCompare(b.id));
    const pageCount = Math.max(1, Math.ceil(entries.length / 10));
    const page = Math.max(0, Math.min(requestedPage, pageCount - 1));
    const start = page * 10;
    const sections = entries.slice(start, start + 10).map((entry, index): APITextDisplayComponent => ({
        type: ComponentType.TextDisplay,
        content: `**${["🥇", "🥈", "🥉"][start + index] ?? `#${start + index + 1}.`} ${escapeMarkdown(entry.name)}**\nCurrent: ${entry.current} days · Longest: ${entry.longest} days`,
    }));
    const container: APIContainerComponent = {
        type: ComponentType.Container,
        components: [{
            type: ComponentType.TextDisplay,
            content: sections.length
                ? "**Message streak leaderboard — Current streak**"
                : "No message streaks have been recorded yet.",
        }],
    };
    container.components.push(...sections);
    if (sections.length) container.components.push({
        type: ComponentType.TextDisplay,
        content: `-# Page ${page + 1}/${pageCount}`,
    });
    if (pageCount > 1) container.components.push({
        type: ComponentType.ActionRow,
        components: [{
            type: ComponentType.Button,
            custom_id: `streak_leaderboard:${Math.max(0, page - 1)}`,
            label: "Previous",
            style: ButtonStyle.Secondary,
            disabled: page === 0,
        }, {
            type: ComponentType.Button,
            custom_id: `streak_leaderboard:${Math.min(pageCount - 1, page + 1)}`,
            label: "Next",
            style: ButtonStyle.Secondary,
            disabled: page === pageCount - 1,
        }],
    });

    return {
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
        components: [container],
    };
};
