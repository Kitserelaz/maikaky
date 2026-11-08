import { ButtonStyle, ComponentType, MessageFlags, escapeMarkdown } from "discord.js";
import type { APIContainerComponent, APITextDisplayComponent, InteractionEditReplyOptions } from "discord.js";
import { calculateStreak } from "./maintenance/messageStreakCalculations.ts";
import type { StreakHistory } from "./streaksData.ts";

const formatDays = (days: number) => `${days} ${days === 1 ? "day" : "days"}`;

export const formatStreakLeaderboard = (
    history: StreakHistory,
    requestedPage: number,
    showPagination = true,
    statusDay = new Date().toISOString().slice(0, 10),
): InteractionEditReplyOptions => {
    const entries = Object.entries(history.users)
        .map(([id, { name, days }]) => {
            const timestamps = new Set(Object.values(days).flatMap(day =>
                day.timestamps.map(timestamp => Date.parse(timestamp))));
            const { current, longest, status: liveStatus } = calculateStreak(timestamps);
            const status = current === 0 ? "ended" : days[statusDay]?.timestamps.length ? "active"
                : liveStatus === "warning" ? "warning" : "grace";
            const currentLabel = `${formatDays(current)}${status === "active" ? " 🔥" : status === "warning" ? " ⚠️" : status === "grace" ? " ⏳" : ""}`;
            return { id, name, current, longest, status, currentLabel };
        })
        .sort((a, b) => b.current - a.current || b.longest - a.longest || a.id.localeCompare(b.id));
    const pageCount = Math.max(1, Math.ceil(entries.length / 10));
    const page = Math.max(0, Math.min(requestedPage, pageCount - 1));
    const start = page * 10;
    const sections = entries.slice(start, start + 10).map((entry, index): APITextDisplayComponent => ({
        type: ComponentType.TextDisplay,
        content: `**${["🥇", "🥈", "🥉"][start + index] ?? `#${start + index + 1}.`} ${showPagination ? escapeMarkdown(entry.name) : `<@${entry.id}>`}**\nCurrent: ${entry.currentLabel} · Longest: ${formatDays(entry.longest)}`,
    }));
    if (!showPagination) {
        let index = 10;
        for (let group = 0; group < 5 && index < entries.length; group++) {
            const entry = entries[index];
            if (entry.current === 0) break;
            let end = index + 1;
            while (end < entries.length && entries[end].current === entry.current) end++;
            const active = entries.slice(index, end).filter(user => user.status === "active").length;
            const warning = entries.slice(index, end).filter(user => user.status === "warning").length;
            const grace = end - index - active - warning;
            const indicators = [active > 0 ? `🔥 ${active}` : "", grace > 0 ? `⏳ ${grace}` : "", warning > 0 ? `⚠️ ${warning}` : ""]
                .filter(Boolean).join(" · ");
            sections.push({
                type: ComponentType.TextDisplay,
                content: end - index > 1
                    ? `**#${index + 1}–#${end} · ${end - index} users tied · ${formatDays(entry.current)} · ${indicators}**`
                    : `**#${index + 1}. <@${entry.id}>** · ${entry.currentLabel}`,
            });
            index = end;
        }
    }
    const heading = sections.length
        ? "**Message streak leaderboard**"
        : "No message streaks have been recorded yet.";
    if (!showPagination) return {
        content: [heading, ...sections.map(section => section.content)].join("\n\n"),
        allowedMentions: { parse: [] },
    };

    const container: APIContainerComponent = {
        type: ComponentType.Container,
        components: [{
            type: ComponentType.TextDisplay,
            content: heading,
        }],
    };
    container.components.push(...sections);
    if (sections.length && showPagination) container.components.push({
        type: ComponentType.TextDisplay,
        content: `-# Page ${page + 1}/${pageCount}`,
    });
    if (pageCount > 1 && showPagination) container.components.push({
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
