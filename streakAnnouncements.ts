import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ApplicationIntegrationType,
    ChannelType,
    Events,
    InteractionContextType,
    MessageFlags,
    PermissionFlagsBits,
    TextChannel,
} from "discord.js";
import type { RESTPutAPIApplicationCommandsJSONBody } from "discord.js";
import client from "./client.ts";
import { dataContent, saveData } from "./dataMsg.ts";
import { getStreakHistory } from "./streaks.ts";
import { streaksGuildId } from "./streaksData.ts";
import { formatStreakLeaderboard } from "./streakLeaderboardFormatting.ts";

export const streakAnnouncementChannelCommand: RESTPutAPIApplicationCommandsJSONBody[number] = {
    type: ApplicationCommandType.ChatInput,
    name: "streak_announcement_channel",
    description: "Post the streak leaderboard now and daily at 00:00 UTC in a channel",
    default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
    integration_types: [ApplicationIntegrationType.GuildInstall],
    contexts: [InteractionContextType.Guild],
    options: [{
        type: ApplicationCommandOptionType.Channel,
        name: "channel",
        description: "The channel for daily streak leaderboard announcements",
        channel_types: [ChannelType.GuildText],
        required: true,
    }],
};

let announcementChannelId = dataContent.streakAnnouncementChannelId;
let timer: ReturnType<typeof setTimeout> | undefined;

const postAnnouncement = async (channelId: string) => {
    const history = getStreakHistory();
    if (!history) throw new Error("Streak history has not loaded yet.");
    const channel = await client.channels.fetch(channelId);
    if (!(channel instanceof TextChannel) || channel.guildId !== streaksGuildId) {
        throw new Error("The announcement channel must be a text channel in the tracked server.");
    }
    const { content, allowedMentions } = formatStreakLeaderboard(history, 0, false);
    await channel.send({ content: content!, allowedMentions });
    console.log(`[streaks] Posted the daily leaderboard in #${channel.name}.`);
};

const scheduleAnnouncement = () => {
    clearTimeout(timer);
    if (!announcementChannelId) return;
    const now = new Date();
    const nextMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    timer = setTimeout(async () => {
        // A command may replace the timer while this announcement is being sent.
        timer = undefined;
        try {
            if (!getStreakHistory()) {
                console.warn("[streaks] Skipped the daily announcement: streak history has not loaded yet.");
            } else if (announcementChannelId) {
                await postAnnouncement(announcementChannelId);
            }
        } catch (error) {
            console.error("[streaks] Daily leaderboard announcement failed:", error);
        } finally {
            if (timer === undefined) scheduleAnnouncement();
        }
    }, nextMidnight - now.getTime());
    console.log(`[streaks] Next leaderboard announcement: ${new Date(nextMidnight).toISOString()}.`);
};

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== "streak_announcement_channel") return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (interaction.guildId !== streaksGuildId) {
        await interaction.editReply("Streak announcements are only available in the tracked server.");
        return;
    }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.editReply("You need Manage Server to configure streak announcements.");
        return;
    }

    const selected = interaction.options.getChannel("channel", true);
    try {
        const channel = await client.channels.fetch(selected.id);
        if (!(channel instanceof TextChannel) || channel.guildId !== streaksGuildId) {
            await interaction.editReply("Choose a text channel in the tracked server.");
            return;
        }
        const bot = await channel.guild.members.fetchMe();
        if (!channel.permissionsFor(bot).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
            await interaction.editReply("I need View Channel and Send Messages in the selected channel.");
            return;
        }

        const previousChannelId = dataContent.streakAnnouncementChannelId;
        dataContent.streakAnnouncementChannelId = channel.id;
        try {
            await saveData();
        } catch (error) {
            dataContent.streakAnnouncementChannelId = previousChannelId;
            throw error;
        }
        announcementChannelId = channel.id;
        scheduleAnnouncement();

        try {
            await postAnnouncement(channel.id);
        } catch (error) {
            console.error("[streaks] Immediate leaderboard announcement failed:", error);
            await interaction.editReply(`Daily announcements are configured for <#${channel.id}> at 00:00 UTC, but the immediate post failed. Check the bot logs.`);
            return;
        }
        await interaction.editReply(`Posted the streak leaderboard in <#${channel.id}>. New announcements will be posted there daily at 00:00 UTC.`);
    } catch (error) {
        console.error("[streaks] Announcement channel setup failed:", error);
        await interaction.editReply("Could not save the announcement channel. Check the bot's permissions and logs.");
    }
});

scheduleAnnouncement();
