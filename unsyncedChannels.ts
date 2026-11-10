import { OverwriteType } from "discord.js";
import type { Guild, PermissionOverwrites } from "discord.js";

const formatOverwrite = (overwrite: PermissionOverwrites | undefined) => {
    if (!overwrite) return "No overwrite";
    const type = overwrite.type === OverwriteType.Role ? "Role" : "Member";
    const allow = overwrite.allow.toArray().join(", ") || "none";
    const deny = overwrite.deny.toArray().join(", ") || "none";
    return `${type} overwrite — allow: ${allow}; deny: ${deny}`;
};

export const getUnsyncedChannelsReport = async (guild: Guild) => {
    const [channels] = await Promise.all([guild.channels.fetch(), guild.roles.fetch()]);
    const reports: string[] = [];
    for (const channel of channels.values()) {
        if (!channel || !("permissionsLocked" in channel) || channel.permissionsLocked !== false) continue;
        const parent = channel.parent;
        if (!parent) continue;
        const lines = [`${parent.name} / ${channel.name} (channel: ${channel.id}, category: ${parent.id})`];
        const channelOverwrites = channel.permissionOverwrites.cache;
        const parentOverwrites = parent.permissionOverwrites.cache;
        const overwriteIds = new Set([...parentOverwrites.keys(), ...channelOverwrites.keys()]);
        for (const id of overwriteIds) {
            const categoryOverwrite = parentOverwrites.get(id);
            const channelOverwrite = channelOverwrites.get(id);
            if (categoryOverwrite && channelOverwrite && categoryOverwrite.type === channelOverwrite.type &&
                categoryOverwrite.allow.bitfield === channelOverwrite.allow.bitfield &&
                categoryOverwrite.deny.bitfield === channelOverwrite.deny.bitfield) continue;
            const overwrite = channelOverwrite ?? categoryOverwrite!;
            const type = overwrite.type === OverwriteType.Role ? "Role" : "Member";
            const name = overwrite.type === OverwriteType.Role
                ? guild.roles.cache.get(id)?.name
                : guild.members.cache.get(id)?.user.tag;
            lines.push(
                `  ${type}${name ? ` ${name}` : ""} (${id})`,
                `    Category: ${formatOverwrite(categoryOverwrite)}`,
                `    Channel:  ${formatOverwrite(channelOverwrite)}`,
            );
        }
        reports.push(lines.join("\n"));
    }
    return reports;
};
