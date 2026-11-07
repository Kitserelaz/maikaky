import { setTimeout as sleep } from "node:timers/promises";

export type LurkrUser = {
    avatar: string | null;
    discriminator: string;
    globalName: string | null;
    username: string;
};

export type LurkrRole = {
    color: number | null;
    id: string;
    name: string;
    position: number;
};

export type LurkrChannel = {
    id: string;
    name: string;
    parentId: string | null;
    position: number;
    type: number;
};

export type LurkrLevel = {
    level: number;
    messageCount: number;
    xp: number;
};

export type LurkrLeaderboardEntry = LurkrLevel & {
    nextLevelXp: number;
    progress: number;
    rank: number;
    user: LurkrUser & { accentColour: string | null };
    // Anonymized entries use anonymous:<position> instead of a Discord ID.
    userId: string;
};

export type LurkrMultiplier = {
    id: string;
    multiplier: number;
    targets: (LurkrRole | LurkrChannel)[];
    type: "Channel" | "Role";
};

export type LurkrRoleReward = {
    id: string;
    level: number;
    roles: LurkrRole[];
};

export type LurkrLeaderboardResponse = {
    guild: {
        icon: string | null;
        id: string;
        memberCount: number;
        name: string;
        nsfw: boolean;
    };
    isManager: boolean;
    levels: LurkrLeaderboardEntry[];
    multipliers: LurkrMultiplier[];
    roleRewards: LurkrRoleReward[];
    vanity: string | null;
    xpGainInterval: number;
    xpGlobalMultiplier: number;
    xpPerMessageMax: number;
    xpPerMessageMin: number;
};

export type LurkrUserLevelResponse = {
    level: LurkrLevel & {
        lastUpdated: string | null;
        rank: number;
    };
    user: LurkrUser;
};

export type LurkrCreateUserLevelRequest = {
    user: {
        avatar: string | null;
        discriminator: string;
        globalName?: string | null;
        username: string;
    };
    xp: number;
};

export type LurkrUpdateUserLevelRequest = {
    triggerCooldown?: boolean;
    xp: number | { increment: number } | { decrement: number };
};

export type LurkrLevelResponse = {
    level: LurkrLevel;
};

export type LurkrRoleRewardsResponse = {
    addRoles: string[];
    removeRoles: string[];
};

export const createLurkr = (apiKey: string) => {
    let queue = Promise.resolve();
    let cooldownUntil = 0;

    const request = <T>(
        path: string,
        method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
        body?: LurkrCreateUserLevelRequest | LurkrUpdateUserLevelRequest,
    ): Promise<T> => {
        const result = queue.then(async (): Promise<T> => {
            for (let attempt = 0; ; attempt++) {
                while (Date.now() < cooldownUntil) {
                    // Node timers accept at most 2^31 - 1 milliseconds per wait.
                    await sleep(Math.min(cooldownUntil - Date.now(), 2_147_483_647));
                }

                const response = await fetch(`https://api.lurkr.gg/v2${path}`, {
                    method,
                    headers: {
                        "X-API-Key": apiKey,
                        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
                    },
                    body: body === undefined ? undefined : JSON.stringify(body),
                });

                const [resetDelay, retryDelay] = ["X-RateLimit-Reset", "Retry-After"].map(header => {
                    const value = response.headers.get(header);
                    if (value === null || value.trim() === "") return undefined;
                    const seconds = Number(value);
                    if (!Number.isFinite(seconds) || seconds < 0) return undefined;
                    const milliseconds = Math.ceil(seconds * 1000);
                    return Number.isFinite(milliseconds) ? milliseconds : undefined;
                });

                if (response.headers.get("X-RateLimit-Remaining")?.trim() === "0" && resetDelay !== undefined) {
                    cooldownUntil = Math.max(cooldownUntil, Date.now() + resetDelay);
                }

                if (response.status === 429 && retryDelay !== undefined) {
                    cooldownUntil = Math.max(cooldownUntil, Date.now() + retryDelay);
                    if (attempt < 2) {
                        await response.body?.cancel();
                        continue;
                    }
                }

                if (!response.ok) {
                    const error = await response.json() as { message: string };
                    throw Object.assign(new Error(`Lurkr API ${response.status}: ${error.message}`), {
                        status: response.status
                    });
                }

                if (response.status === 204) return undefined as T;
                return await response.json() as T;
            }
        });

        queue = result.then(() => {}, () => {});
        return result;
    };

    return {
        getLeaderboard: (entry: string, page = 1): Promise<LurkrLeaderboardResponse> => {
            const query = new URLSearchParams({ page: String(page) });
            return request(`/levels/${encodeURIComponent(entry)}?${query}`);
        },

        getUserLevel: (guildId: string, userId: string): Promise<LurkrUserLevelResponse> =>
            request(`/levels/${encodeURIComponent(guildId)}/users/${encodeURIComponent(userId)}`),

        createUserLevel: (
            guildId: string,
            userId: string,
            data: LurkrCreateUserLevelRequest,
        ): Promise<LurkrLevelResponse> =>
            request(`/levels/${encodeURIComponent(guildId)}/users/${encodeURIComponent(userId)}`, "POST", data),

        updateUserLevel: (
            guildId: string,
            userId: string,
            data: LurkrUpdateUserLevelRequest,
        ): Promise<LurkrLevelResponse> =>
            request(`/levels/${encodeURIComponent(guildId)}/users/${encodeURIComponent(userId)}`, "PATCH", data),

        deleteUserLevel: (guildId: string, userId: string): Promise<void> =>
            request(`/levels/${encodeURIComponent(guildId)}/users/${encodeURIComponent(userId)}`, "DELETE"),

        getRoleRewards: (guildId: string, userId: string, level: number): Promise<LurkrRoleRewardsResponse> => {
            const query = new URLSearchParams({ userId, level: String(level) });
            return request(`/guilds/${encodeURIComponent(guildId)}/role-rewards/level?${query}`);
        },
    };
};
