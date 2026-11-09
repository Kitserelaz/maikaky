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
import { postRoleInformation } from "./roleInformation.ts";

export const postRoleInformationCommand: RESTPutAPIApplicationCommandsJSONBody[number] = {
    type: ApplicationCommandType.ChatInput,
    name: "post_role_information",
    description: "Post the role guide in this channel",
    default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
    integration_types: [ApplicationIntegrationType.GuildInstall],
    contexts: [InteractionContextType.Guild],
};

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== "post_role_information") return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.editReply("You need Manage Server to post role information.");
        return;
    }

    try {
        const channel = await client.channels.fetch(interaction.channelId);
        if (!channel?.isSendable()) {
            await interaction.editReply("This channel does not support sending messages.");
            return;
        }

        await postRoleInformation(channel);
        await interaction.editReply("Posted the role information.");
    } catch (error) {
        console.error("Posting role information failed:", error);
        await interaction.editReply("Could not finish posting the role information. Check the bot's permissions and logs.");
    }
});
