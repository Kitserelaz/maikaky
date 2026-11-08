import { ApplicationRoleConnectionMetadataType, DiscordAPIError, Routes } from "discord.js";
import client from "./client.ts";
import { dataContent } from "./dataMsg.ts";
import { createLurkr } from "./lurkr.ts";
import { calculateStreak } from "./maintenance/messageStreakCalculations.ts";
import { waitForStreakHistory } from "./streaks.ts";
import { streaksGuildId } from "./streaksData.ts";

const getLinkedRolesSchema = (roleName: string | undefined) => [
    {
        type: ApplicationRoleConnectionMetadataType.BooleanEqual,
        key: "has_required_role",
        name: "Common Role",
        description: roleName === undefined ? "No Common Role configured." : `Has the role ${roleName}`,
    },
    {
        type: ApplicationRoleConnectionMetadataType.IntegerGreaterThanOrEqual,
        key: "current_streak",
        name: "Current message streak",
        description: "Required current message streak",
    },
    {
        type: ApplicationRoleConnectionMetadataType.IntegerGreaterThanOrEqual,
        key: "longest_streak",
        name: "Longest message streak",
        description: "Required longest message streak",
    },
    {
        type: ApplicationRoleConnectionMetadataType.IntegerGreaterThanOrEqual,
        key: "level",
        name: "Lurkr level",
        description: "Required Lurkr level",
    },
];

export const registerLinkedRolesSchema = async () => {
    const roleId = dataContent.linkedRoles?.requiredRoleId;
    const guild = await client.guilds.fetch(streaksGuildId);
    const role = roleId ? await guild.roles.fetch(roleId) : null;
    await client.rest.put(Routes.applicationRoleConnectionMetadata(client.user!.id), {
        body: getLinkedRolesSchema(role?.name),
    });
};

const lurkr = createLurkr(process.env.LURKR_API_KEY!);

export const getLinkedRolesMetadata = async (userId: string) => {
    const history = await waitForStreakHistory();

    const guild = await client.guilds.fetch(streaksGuildId);
    const member = await guild.members.fetch({ user: userId, force: true }).catch(error => {
        if (error instanceof DiscordAPIError && error.code === 10007) return null;
        throw error;
    });
    const days = member ? history.users[userId]?.days : undefined;
    const timestamps = new Set(Object.values(days ?? {}).flatMap(day =>
        day.timestamps.map(timestamp => Date.parse(timestamp))));
    const streak = timestamps.size > 0 ? calculateStreak(timestamps) : { current: 0, longest: 0 };
    let level = 0;
    if (member) {
        try {
            level = (await lurkr.getUserLevel(streaksGuildId, userId)).level.level;
        } catch (error) {
            if (!(error instanceof Error && "status" in error && error.status === 404)) throw error;
        }
    }

    const requiredRoleId = dataContent.linkedRoles?.requiredRoleId;
    return {
        platform_name: guild.name.slice(0, 50),
        platform_username: member?.user.username ?? userId,
        metadata: {
            has_required_role: requiredRoleId && member?.roles.cache.has(requiredRoleId) ? "1" : "0",
            current_streak: String(streak.current),
            longest_streak: String(streak.longest),
            level: String(level),
        },
    };
};
