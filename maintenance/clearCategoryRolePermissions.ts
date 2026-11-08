import { ChannelType, OverwriteType } from "discord.js";
import client from "../client.ts";

const guildId = "1216816878937313442";
const roleId = "1568865023810474095";

try {
    const guild = await client.guilds.fetch(guildId);
    const channels = await guild.channels.fetch();
    // Identify unsynced channels before changing their categories' overwrites.
    const targets = channels.filter(channel => channel !== null && (
        channel.type === ChannelType.GuildCategory || channel.permissionsLocked === false
    ));

    for (const channel of targets.values()) {
        if (!channel) continue;

        // Replace this role's overwrite with no allowed or denied permissions.
        await channel.permissionOverwrites.create(roleId, {}, { type: OverwriteType.Role });
        console.log(`Cleared permission override for role ${roleId} in ${channel.name} (${channel.id}).`);
    }
} finally {
    await client.destroy();
}
