import {
    ApplicationCommandType,
    ApplicationIntegrationType,
    Events,
    InteractionContextType,
    MessageFlags,
    PermissionFlagsBits,
} from "discord.js";
import type { RESTPutAPIApplicationCommandsJSONBody } from "discord.js";
import client from "./client.ts";
import { getUnsyncedChannelsReport } from "./unsyncedChannels.ts";

export const unsyncedChannelsCommand: RESTPutAPIApplicationCommandsJSONBody[number] = {
    type: ApplicationCommandType.ChatInput,
    name: "unsynced_channels",
    description: "List unsynced channels and their permission overwrite differences from their categories",
    default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
    integration_types: [ApplicationIntegrationType.GuildInstall],
    contexts: [InteractionContextType.Guild],
};

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== "unsynced_channels") return;
    if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: "You need Manage Server to list unsynced channels.", flags: MessageFlags.Ephemeral });
        return;
    }
    await interaction.deferReply();
    try {
        const guild = await client.guilds.fetch(interaction.guildId);
        const reports = await getUnsyncedChannelsReport(guild);
        const summary = `Found ${reports.length} unsynced channels. Differences include all roles (including stats roles) and member overwrites.`;
        const content = [summary, ...reports].join("\n\n");
        if (content.length <= 2000) {
            await interaction.editReply({ content, allowedMentions: { parse: [] } });
        } else {
            await interaction.editReply({
                content: `${summary} See the attached report for all differences.`,
                files: [{ attachment: Buffer.from(content, "utf8"), name: "unsynced-channels.txt" }],
            });
        }
    } catch (error) {
        console.error("[Unsynced Channels] Could not generate the permission overwrite report:", error);
        await interaction.editReply("Could not list unsynced channels. Check the bot's permissions and logs.");
    }
});
