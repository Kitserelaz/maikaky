import { OverwriteType } from "discord.js";
import type { Guild, GuildChannel } from "discord.js";

export const auditStatsRoleOverwrites = async (guild: Guild, roleIds: string[]) => {
    const channels = await guild.channels.fetch();
    const statsRoleIds = new Set(roleIds);
    const matches: GuildChannel[] = [];
    for (const channel of channels.values()) {
        if (!channel || !("permissionsLocked" in channel) || channel.permissionsLocked !== false) continue;
        const parent = channel.parent;
        if (!parent) continue;
        const channelOverwrites = channel.permissionOverwrites.cache.filter(overwrite =>
            overwrite.type !== OverwriteType.Role || !statsRoleIds.has(overwrite.id));
        const parentOverwrites = parent.permissionOverwrites.cache.filter(overwrite =>
            overwrite.type !== OverwriteType.Role || !statsRoleIds.has(overwrite.id));
        if (channelOverwrites.size !== parentOverwrites.size) continue;
        const matching = channelOverwrites.every(overwrite => {
            const parentOverwrite = parentOverwrites.get(overwrite.id);
            return parentOverwrite?.type === overwrite.type &&
                parentOverwrite.allow.bitfield === overwrite.allow.bitfield &&
                parentOverwrite.deny.bitfield === overwrite.deny.bitfield;
        });
        if (matching) matches.push(channel);
    }
    return matches;
};
