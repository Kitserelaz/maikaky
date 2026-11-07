import { ChannelType, PermissionFlagsBits } from "discord.js";
import client from "./client.ts";

export const getServerIndex = async (serverId: string, roleId?: string): Promise<string> => {
    const guild = await client.guilds.fetch(serverId);
    const role = roleId ? await guild.roles.fetch(roleId) : null;
    const channels = [...(await guild.channels.fetch()).values()]
        .filter(channel => channel !== null)
        .sort((a, b) => a.rawPosition - b.rawPosition);
    const visibleChannels = channels.filter(channel => channel.type !== ChannelType.GuildCategory &&
        (!roleId || (role && channel.permissionsFor(role).has(PermissionFlagsBits.ViewChannel))));
    const uncategorized = visibleChannels.filter(channel => !channel.parentId);
    const sections = uncategorized.length
        ? [`# Uncategorized\n${uncategorized.map(channel => `<#${channel.id}>`).join("\n")}`]
        : [];

    for (const category of channels.filter(channel => channel.type === ChannelType.GuildCategory)) {
        const children = visibleChannels.filter(channel => channel.parentId === category.id);
        if (roleId && children.length === 0) continue;
        sections.push([`# ${category.name}`, ...children.map(channel => `<#${channel.id}>`)].join("\n"));
    }

    return sections.join("\n\n");
};
