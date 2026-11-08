import assert from "node:assert/strict";
import { test } from "bun:test";
import { ChannelType, Collection, OverwriteType } from "discord.js";
import type { Guild } from "discord.js";
import { setupStatsRoleOverwrites } from "./statsRoleSetup.ts";

type Overwrite = { id: string; type: OverwriteType; allow: bigint; deny: bigint };

const cachedOverwrite = (overwrite: Overwrite) => ({
    id: overwrite.id, type: overwrite.type,
    allow: { bitfield: overwrite.allow }, deny: { bitfield: overwrite.deny },
});

test("setup batches all stats roles per snapshotted channel and continues after a channel failure", async () => {
    const calls: string[] = [];
    const makeChannel = (id: string, type: ChannelType, permissionsLocked: boolean | null) => ({
        id, name: id, type, permissionsLocked,
        permissionOverwrites: { cache: new Collection(), set: async (overwrites: Overwrite[]) => {
            calls.push(id);
            assert.deepEqual(overwrites, [
                { id: "role1", type: OverwriteType.Role, allow: 0n, deny: 0n },
                { id: "role2", type: OverwriteType.Role, allow: 0n, deny: 0n },
            ]);
            if (id === "category") synced.permissionsLocked = false;
            if (id === "unsynced") throw new Error("Missing permissions");
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
    assert.deepEqual(calls, ["category", "unsynced"]);
    assert.deepEqual(result, { cleared: 2, skipped: 0, failed: 2 });
});

test("setup preserves other overwrites, batches needed changes, and skips fully configured channels", async () => {
    const calls: Overwrite[][] = [];
    const existing: Overwrite[] = [
        { id: "empty", type: OverwriteType.Role, allow: 0n, deny: 0n },
        { id: "allowed", type: OverwriteType.Role, allow: 1n, deny: 0n },
        { id: "denied", type: OverwriteType.Role, allow: 0n, deny: 1n },
        { id: "other-role", type: OverwriteType.Role, allow: 2n, deny: 4n },
        { id: "member", type: OverwriteType.Member, allow: 8n, deny: 16n },
    ];
    const cache = new Collection(existing.map(overwrite => [overwrite.id, cachedOverwrite(overwrite)]));
    const channel = {
        id: "channel", name: "channel", type: ChannelType.GuildText, permissionsLocked: false,
        permissionOverwrites: {
            cache,
            set: async (overwrites: Overwrite[]) => {
                calls.push(overwrites);
                cache.clear();
                for (const overwrite of overwrites) cache.set(overwrite.id, cachedOverwrite(overwrite));
            },
        },
    };
    const guild = { channels: { fetch: async () => new Collection([[channel.id, channel]]) } } as unknown as Guild;
    const roles = ["empty", "allowed", "denied", "missing"];
    assert.deepEqual(await setupStatsRoleOverwrites(guild, roles), { cleared: 3, skipped: 1, failed: 0 });
    assert.equal(calls.length, 1);
    const sent = new Map(calls[0]!.map(overwrite => [overwrite.id, overwrite]));
    assert.equal(sent.size, 6);
    for (const id of roles) assert.deepEqual(sent.get(id), { id, type: OverwriteType.Role, allow: 0n, deny: 0n });
    assert.deepEqual(sent.get("other-role"), existing[3]);
    assert.deepEqual(sent.get("member"), existing[4]);
    calls.length = 0;
    assert.deepEqual(await setupStatsRoleOverwrites(guild, roles), { cleared: 0, skipped: 4, failed: 0 });
    assert.deepEqual(calls, []);
});
