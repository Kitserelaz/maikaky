import { ChannelType, OverwriteType } from "discord.js";
import type { Guild } from "discord.js";

export const setupStatsRoleOverwrites = async (guild: Guild, roleIds: string[]) => {
    const channels = await guild.channels.fetch();
    // Snapshot targets before category changes can affect their children's sync status.
    const targets = channels.filter(channel => channel !== null && (
        channel.type === ChannelType.GuildCategory || ("permissionsLocked" in channel && channel.permissionsLocked === false)
    ));
    let cleared = 0;
    let failed = 0;
    for (const channel of targets.values()) {
        if (!channel || !("permissionOverwrites" in channel)) continue;
        for (const roleId of roleIds) {
            try {
                await channel.permissionOverwrites.create(roleId, {}, { type: OverwriteType.Role });
                cleared++;
                console.log(`[Stats Roles] Cleared permission override for role ${roleId} in ${channel.name} (${channel.id}).`);
            } catch (error) {
                failed++;
                const code = error instanceof Error && "code" in error ? String(error.code) : "unknown";
                console.error(`[Stats Roles] Could not clear role ${roleId} in channel ${channel.id} (code=${code}).`);
            }
        }
    }
    return { cleared, failed };
};
