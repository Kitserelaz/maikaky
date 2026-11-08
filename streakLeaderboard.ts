import { ApplicationCommandType, Events } from "discord.js";
import type { RESTPutAPIApplicationCommandsJSONBody } from "discord.js";
import client from "./client.ts";
import { getStreakHistory } from "./streaks.ts";
import { streaksGuildId } from "./streaksData.ts";
import { formatStreakLeaderboard } from "./streakLeaderboardFormatting.ts";

export const streakLeaderboardCommand: RESTPutAPIApplicationCommandsJSONBody[number] = {
    type: ApplicationCommandType.ChatInput,
    name: "streak_leaderboard",
    description: "Browse the message streak leaderboard, ranked by current streak"
};

client.on(Events.InteractionCreate, async interaction => {
    const buttonPage = interaction.isButton() ? interaction.customId.match(/^streak_leaderboard:(\d+)$/) : null;
    const isCommand = interaction.isChatInputCommand() && interaction.commandName === "streak_leaderboard";
    if (!isCommand && !buttonPage) return;
    if (!interaction.isChatInputCommand() && !interaction.isButton()) return;
    if (interaction.guildId !== streaksGuildId) {
        await interaction.reply("The streak leaderboard is only available in the tracked server.");
        return;
    }

    const history = getStreakHistory();
    if (!history) {
        await interaction.reply("Streak tracking is initializing. Please try again shortly.");
        return;
    }

    if (interaction.isButton()) await interaction.deferUpdate();
    else await interaction.deferReply();
    await interaction.editReply(formatStreakLeaderboard(history, buttonPage ? Number(buttonPage[1]) : 0));
});
