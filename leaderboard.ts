import { ApplicationCommandType, Events, escapeMarkdown } from "discord.js";
import type { RESTPutAPIApplicationCommandsJSONBody } from "discord.js";
import client from "./client.ts";
import { leaderboardData } from "./leaderboardData.ts";

export const leaderboardCommand: RESTPutAPIApplicationCommandsJSONBody[number] = {
    type: ApplicationCommandType.ChatInput,
    name: "leaderboard",
    description: "Show the top 10 recorded members in this server's Lurkr leaderboard"
};

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "leaderboard") return;
    if (!interaction.guildId) {
        await interaction.reply("Use this command in a server.");
        return;
    }

    if (leaderboardData.guildId && interaction.guildId !== leaderboardData.guildId) {
        await interaction.reply("The leaderboard is only available in the tracked server.");
        return;
    }
    if (leaderboardData.status === "loading") {
        await interaction.reply("The leaderboard is initializing. Please try again shortly.");
        return;
    }
    if (leaderboardData.status === "failed") {
        await interaction.reply("The leaderboard could not initialize. Check the bot logs.");
        return;
    }

    const entries = [...leaderboardData.levels.entries()]
        .sort(([leftId, left], [rightId, right]) =>
            right.level.xp - left.level.xp || leftId.localeCompare(rightId)
        )
        .slice(0, 10);
    const lines = entries.map(([, entry], index) =>
        `${index + 1}. ${escapeMarkdown(entry.user.username)} — Level ${entry.level.level} · ${entry.level.xp.toLocaleString("en-US")} XP`
    );
    const content = lines.length
        ? `**Lurkr leaderboard — Top 10 recorded members**\n${lines.join("\n")}`
        : "No recorded member levels are available yet.";
    const notice = leaderboardData.failedUserIds.size
        ? "\nSome member data could not be refreshed; results may be incomplete or outdated."
        : "";

    await interaction.reply({
        content: content + notice,
        allowedMentions: { parse: [] }
    });
});
