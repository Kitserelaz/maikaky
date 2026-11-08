import { ChannelType, OverwriteType } from "discord.js";
import type { Guild } from "discord.js";

export const setupStatsRoleOverwrites = async (guild: Guild, roleIds: string[]) => {
    const channels = await guild.channels.fetch();
    // Snapshot targets before category changes can affect their children's sync status.
    const targets = channels.filter(channel => channel !== null && (
        channel.type === ChannelType.GuildCategory || ("permissionsLocked" in channel && channel.permissionsLocked === false)
    ));
    let cleared = 0;
    let skipped = 0;
    let failed = 0;
    for (const channel of targets.values()) {
        if (!channel || !("permissionOverwrites" in channel)) continue;
        const overwrites = new Map(channel.permissionOverwrites.cache.map(overwrite => [overwrite.id, {
            id: overwrite.id,
            type: overwrite.type,
            allow: overwrite.allow.bitfield,
            deny: overwrite.deny.bitfield,
        }]));
        let changed = 0;
        for (const roleId of roleIds) {
            const overwrite = overwrites.get(roleId);
            if (overwrite && overwrite.allow === 0n && overwrite.deny === 0n) {
                skipped++;
                continue;
            }
            overwrites.set(roleId, { id: roleId, type: OverwriteType.Role, allow: 0n, deny: 0n });
            changed++;
        }
        if (changed === 0) continue;
        try {
            await channel.permissionOverwrites.set([...overwrites.values()]);
            cleared += changed;
            console.log(`[Stats Roles] Cleared ${changed} stats role permission overwrites in ${channel.name} (${channel.id}) in one update.`);
        } catch (error) {
            failed += changed;
            const code = error instanceof Error && "code" in error ? String(error.code) : "unknown";
            console.error(`[Stats Roles] Could not clear ${changed} stats role overwrites in channel ${channel.id} (code=${code}).`);
        }
    }
    return { cleared, skipped, failed };
};
