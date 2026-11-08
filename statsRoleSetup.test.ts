import assert from "node:assert/strict";
import { test } from "bun:test";
import { ChannelType, Collection, OverwriteType } from "discord.js";
import type { Guild } from "discord.js";
import { setupStatsRoleOverwrites } from "./statsRoleSetup.ts";

test("setup clears all stats roles on snapshotted targets and continues after an overwrite failure", async () => {
    const calls: [string, string][] = [];
    const makeChannel = (id: string, type: ChannelType, permissionsLocked: boolean | null) => ({
        id, name: id, type, permissionsLocked,
        permissionOverwrites: { create: async (roleId: string, permissions: object, options: object) => {
            calls.push([id, roleId]);
            assert.deepEqual(permissions, {});
            assert.deepEqual(options, { type: OverwriteType.Role });
            if (id === "category") synced.permissionsLocked = false;
            if (id === "unsynced" && roleId === "role1") throw new Error("Missing permissions");
        } },
    });
    const category = makeChannel("category", ChannelType.GuildCategory, null);
    const synced = makeChannel("synced", ChannelType.GuildText, true);
    const unsynced = makeChannel("unsynced", ChannelType.GuildText, false);
    const guild = {
        channels: { fetch: async () => new Collection([
            ["category", category], ["synced", synced], ["unsynced", unsynced], ["missing", null],
        ]) },
    } as unknown as Guild;
    const result = await setupStatsRoleOverwrites(guild, ["role1", "role2"]);
    assert.deepEqual(calls, [["category", "role1"], ["category", "role2"], ["unsynced", "role1"], ["unsynced", "role2"]]);
    assert.deepEqual(result, { cleared: 3, failed: 1 });
});
