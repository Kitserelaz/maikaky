import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ApplicationIntegrationType,
    ChannelType,
    Events,
    MessageFlags,
    PermissionFlagsBits,
    TextChannel,
    WebhookClient
} from "discord.js";
import type { RESTPutAPIApplicationCommandsJSONBody } from "discord.js";
import client from "./client.ts";
import { dataContent, saveData } from "./dataMsg.ts";
import { getServerIndex } from "./serverIndex.ts";

export const serverIndexCommands: RESTPutAPIApplicationCommandsJSONBody = [
    {
        type: ApplicationCommandType.ChatInput,
        name: "setup_server_index",
        description: "Post and automatically update a server channel index",
        default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
        integration_types: [ApplicationIntegrationType.GuildInstall],
        options: [
            {
                type: ApplicationCommandOptionType.Channel,
                name: "channel",
                description: "The channel where the index will be posted",
                channel_types: [ChannelType.GuildText],
                required: true
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "name",
                description: "The webhook name",
                min_length: 1,
                max_length: 80,
                required: true
            },
            {
                type: ApplicationCommandOptionType.Role,
                name: "member_role",
                description: "Only include channels this role can view",
                required: false
            }
        ]
    },
    {
        type: ApplicationCommandType.ChatInput,
        name: "remove_server_index_setup",
        description: "Remove the server channel index setup",
        default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
        integration_types: [ApplicationIntegrationType.GuildInstall]
    }
];

const setups = dataContent.serverIndexes ??= {};
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const updates = new Map<string, Promise<void>>();

const updateIndex = async (serverId: string) => {
    const setup = setups[serverId];
    if (!setup) return;

    const webhook = new WebhookClient({ id: setup.webhookId, token: setup.webhookToken });
    const index = await getServerIndex(serverId, setup.roleId);
    const messages: string[] = [];
    for (const section of (index || "No channels found.").split("\n\n")) {
        const last = messages.length - 1;
        if (last >= 0 && messages[last].length + section.length + 2 <= 2000) {
            messages[last] += `\n\n${section}`;
            continue;
        }
        for (const [i, line] of section.split("\n").entries()) {
            const current = messages.length - 1;
            if (i === 0 || messages[current].length + line.length + 1 > 2000) {
                messages.push(line);
            } else {
                messages[current] += `\n${line}`;
            }
        }
    }

    for (const [i, content] of messages.entries()) {
        if (setup.messageIds[i]) {
            await webhook.editMessage(setup.messageIds[i], { content, allowedMentions: { parse: [] } });
        } else {
            const message = await webhook.send({ content, allowedMentions: { parse: [] } });
            setup.messageIds.push(message.id);
            await saveData();
        }
    }
    while (setup.messageIds.length > messages.length) {
        await webhook.deleteMessage(setup.messageIds[setup.messageIds.length - 1]);
        setup.messageIds.pop();
        await saveData();
    }
};

const queueUpdate = (serverId: string) => {
    const previous = updates.get(serverId) ?? Promise.resolve();
    const update = previous.catch(() => {}).then(() => updateIndex(serverId));
    updates.set(serverId, update);
    void update.catch(error => console.error("Failed to update server index:", error)).finally(() => {
        if (updates.get(serverId) === update) updates.delete(serverId);
    });
    return update;
};

const scheduleUpdate = (serverId: string) => {
    if (!setups[serverId]) return;
    clearTimeout(timers.get(serverId));
    timers.set(serverId, setTimeout(() => {
        timers.delete(serverId);
        void queueUpdate(serverId);
    }, 1000));
};

client.on(Events.ChannelCreate, channel => {
    if (channel.isDMBased()) return;
    scheduleUpdate(channel.guildId);
});
client.on(Events.ChannelDelete, channel => {
    if (channel.isDMBased()) return;
    scheduleUpdate(channel.guildId);
});
client.on(Events.ChannelUpdate, (_oldChannel, channel) => {
    if (channel.isDMBased()) return;
    scheduleUpdate(channel.guildId);
});
client.on(Events.GuildRoleUpdate, (_oldRole, role) => {
    if (setups[role.guild.id]?.roleId) scheduleUpdate(role.guild.id);
});
client.on(Events.GuildRoleDelete, role => {
    if (setups[role.guild.id]?.roleId === role.id) scheduleUpdate(role.guild.id);
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand() || !interaction.guildId) return;
    if (interaction.commandName !== "setup_server_index" && interaction.commandName !== "remove_server_index_setup") return;
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    const serverId = interaction.guildId;

    try {
        if (interaction.commandName === "setup_server_index") {
            if (setups[serverId]) return await interaction.editReply("A server index is already set up. Remove it first.");
            const channel = interaction.options.getChannel("channel", true);
            if (!(channel instanceof TextChannel)) return await interaction.editReply("Choose a server text channel.");
            const webhook = await channel.createWebhook({ name: interaction.options.getString("name", true) });
            if (!webhook.token) throw new Error("The webhook has no token.");
            setups[serverId] = {
                webhookId: webhook.id,
                webhookToken: webhook.token,
                messageIds: [],
                roleId: interaction.options.getRole("member_role")?.id
            };
            await saveData();
            await queueUpdate(serverId);
            return await interaction.editReply("Server index set up.");
        }

        const setup = setups[serverId];
        if (!setup) return await interaction.editReply("There is no server index setup to remove.");
        clearTimeout(timers.get(serverId));
        timers.delete(serverId);
        await updates.get(serverId)?.catch(() => {});
        await new WebhookClient({ id: setup.webhookId, token: setup.webhookToken }).delete();
        delete setups[serverId];
        await saveData();
        return await interaction.editReply("Server index setup removed.");
    } catch (error) {
        console.error("Server index setup failed:", error);
        return await interaction.editReply("Could not complete the server index request. Check the bot's permissions and logs.");
    }
});

for (const serverId of Object.keys(setups)) {
    void queueUpdate(serverId);
}
