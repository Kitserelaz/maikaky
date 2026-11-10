import assert from "node:assert/strict";
import { test } from "bun:test";
import { ChannelType, Collection, OverwriteType, PermissionFlagsBits, PermissionsBitField } from "discord.js";
import type { Guild } from "discord.js";
import { getUnsyncedChannelsReport } from "./unsyncedChannels.ts";

test("report includes all unsynced channel types and distinguishes changed, absent, and empty overwrites", async () => {
    const overwrite = (id: string, allow = 0n, deny = 0n, type = OverwriteType.Role) => ({
        id, type, allow: new PermissionsBitField(allow), deny: new PermissionsBitField(deny),
    });
    const cache = (overwrites: ReturnType<typeof overwrite>[]) => new Collection(overwrites.map(item => [item.id, item]));
    const parent = {
        id: "category", name: "Category", type: ChannelType.GuildCategory, permissionsLocked: null, parent: null,
        permissionOverwrites: { cache: cache([
            overwrite("unchanged", PermissionFlagsBits.ViewChannel),
            overwrite("stats", PermissionFlagsBits.SendMessages),
            overwrite("member", PermissionFlagsBits.ViewChannel, 0n, OverwriteType.Member),
            overwrite("parent-only-empty"),
        ]) },
    };
    const channel = {
        id: "text", name: "Text", type: ChannelType.GuildText, parent, permissionsLocked: false,
        permissionOverwrites: { cache: cache([
            overwrite("unchanged", PermissionFlagsBits.ViewChannel),
            overwrite("stats", 0n, PermissionFlagsBits.SendMessages),
            overwrite("member", 0n, PermissionFlagsBits.ViewChannel, OverwriteType.Member),
            overwrite("child-only-empty"),
        ]) },
    };
    const voice = { ...channel, id: "voice", name: "Voice", type: ChannelType.GuildVoice };
    const channels = [parent, channel, voice,
        { ...channel, id: "synced", permissionsLocked: true },
        { ...channel, id: "uncategorized", parent: null, permissionsLocked: null },
    ];
    const roles = new Collection([["stats", { name: "Stats Role" }]]);
    const guild = {
        channels: { fetch: async () => new Collection([...channels.map(item => [item.id, item] as const), ["missing", null]]) },
        roles: { cache: roles, fetch: async () => roles },
        members: { cache: new Collection([["member", { user: { tag: "member-name" } }]]) },
    } as unknown as Guild;
    const reports = await getUnsyncedChannelsReport(guild);
    assert.equal(reports.length, 2);
    assert.match(reports[0]!, /^Category \/ Text \(channel: text, category: category\)/);
    assert.match(reports[1]!, /^Category \/ Voice \(channel: voice, category: category\)/);
    assert.ok(reports[0]!.includes("Role Stats Role (stats)\n    Category: Role overwrite — allow: SendMessages; deny: none\n    Channel:  Role overwrite — allow: none; deny: SendMessages"));
    assert.ok(reports[0]!.includes("Member member-name (member)\n    Category: Member overwrite — allow: ViewChannel; deny: none\n    Channel:  Member overwrite — allow: none; deny: ViewChannel"));
    assert.ok(reports[0]!.includes("Role (parent-only-empty)\n    Category: Role overwrite — allow: none; deny: none\n    Channel:  No overwrite"));
    assert.ok(reports[0]!.includes("Role (child-only-empty)\n    Category: No overwrite\n    Channel:  Role overwrite — allow: none; deny: none"));
    assert.ok(!reports[0]!.includes("unchanged"));
});
