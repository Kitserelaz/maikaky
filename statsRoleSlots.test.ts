import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "bun:test";
import { Collection, Events, PermissionFlagsBits, PermissionsBitField } from "discord.js";
import type { Client } from "discord.js";
import { canClaimStatsRoleSlot, formatUnclaimedStatsRoleName, getStatsRoleSlot } from "./statsRoleSlotData.ts";
import type { StatsRoleSlots } from "./statsRoleSlotData.ts";
import { startStatsRoleSlots } from "./statsRoleSlots.ts";

test("owners retain their slot while unassigned members advance", () => {
    const slots: StatsRoleSlots = { "1": { roleId: "role1" }, "2": { roleId: "role2" } };
    assert.equal(getStatsRoleSlot(slots, "first"), 1);
    assert.equal(getStatsRoleSlot(slots, "second"), 1);
    assert.equal(canClaimStatsRoleSlot(slots, "2", "second"), false);
    slots["1"]!.ownerId = "first";
    assert.equal(getStatsRoleSlot(slots, "first"), 1);
    assert.equal(getStatsRoleSlot(slots, "second"), 2);
    assert.equal(canClaimStatsRoleSlot(slots, "1", "second"), false);
    slots["2"]!.ownerId = "second";
    assert.equal(getStatsRoleSlot(slots, "second"), 2);
    assert.equal(getStatsRoleSlot(slots, "third"), 3);
    assert.equal(getStatsRoleSlot(JSON.parse(JSON.stringify(slots)), "first"), 1);
});

test("simultaneous role claims persist the first owner, rename the role, and remove competing claims", async () => {
    const client = new EventEmitter();
    const slots: StatsRoleSlots = { "1": { roleId: "role1" }, "2": { roleId: "role2" } };
    const removals: string[] = [];
    const renames: string[] = [];
    const saves: string[] = [];
    const published: number[][] = [];
    const roles = new Map(["role1", "role2"].map((id, index) => {
        const role = {
            name: `Unclaimed Role ${index + 1}`,
            setName: async (name: string) => { role.name = name; renames.push(name); },
        };
        return [id, role] as const;
    }));
    let initialized = false;
    const guild = {
        id: "guild",
        roles: { fetch: async (id: string) => roles.get(id)! },
        members: { fetch: async (options?: { user: string }) => {
            if (options) return members.get(options.user)!;
            initialized = true;
            return new Collection();
        } },
    };
    const makeMember = (id: string) => {
        const cache = new Collection([["role1", { id: "role1" }]]);
        return {
            id, guild, user: { username: `${id}-name` },
            roles: {
                cache,
                remove: async (roleId: string) => { cache.delete(roleId); removals.push(id); },
            },
        };
    };
    const members = new Map([["first", makeMember("first")], ["second", makeMember("second")]]);
    Object.assign(client, { guilds: { fetch: async () => guild } });
    startStatsRoleSlots(client as unknown as Client, "guild", slots, { nameFormat: "{status} Role {slot}" },
        async () => { saves.push(JSON.stringify(slots)); },
        async () => { published.push([getStatsRoleSlot(slots, "first"), getStatsRoleSlot(slots, "second")]); });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(initialized, true);
    client.emit(Events.GuildMemberUpdate, { roles: { cache: new Collection() } }, members.get("first"));
    client.emit(Events.GuildMemberUpdate, { roles: { cache: new Collection() } }, members.get("second"));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(slots["1"]!.ownerId, "first");
    assert.equal(saves.length, 1);
    assert.equal(JSON.parse(saves[0]!)["1"].ownerId, "first");
    assert.deepEqual(renames, ["Locked Role 2", "first-name", "Unclaimed Role 2"]);
    assert.equal(roles.get("role1")!.name, "first-name");
    assert.equal(roles.get("role2")!.name, "Unclaimed Role 2");
    assert.deepEqual(removals, ["second"]);
    assert.deepEqual(published.at(-1), [1, 2]);
    client.emit(Events.GuildMemberUpdate, { roles: { cache: new Collection([["role1", {}]]) } }, members.get("second"));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(slots["1"]!.ownerId, "first");
    assert.equal(saves.length, 1);
    members.get("first")!.roles.cache.delete("role1");
    client.emit(Events.GuildMemberUpdate, { roles: { cache: new Collection([["role1", {}]]) } }, members.get("first"));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(slots["1"]!.ownerId, undefined);
    assert.equal(saves.length, 2);
    assert.equal(JSON.parse(saves[1]!)["1"].ownerId, undefined);
    assert.equal(roles.get("role1")!.name, "Unclaimed Role 1");
    assert.equal(roles.get("role2")!.name, "Locked Role 2");
    assert.deepEqual(published.at(-1), [1, 1]);
});

test("managed Linked Roles can be configured when permission and hierarchy checks pass", async () => {
    const client = new EventEmitter();
    const slots: StatsRoleSlots = {};
    const replies: string[] = [];
    let saves = 0;
    const botMember = {
        id: "bot",
        permissions: new PermissionsBitField(PermissionFlagsBits.ManageRoles),
        roles: { highest: { id: "bot-role", position: 220, comparePositionTo: () => 1 } },
    };
    const role = {
        id: "linked-role", name: "Unclaimed Role 1", managed: true, editable: false, position: 2,
        tags: { guildConnections: true }, setName: async (name: string) => { role.name = name; },
    };
    const guild = {
        roles: { fetch: async () => role },
        members: { fetchMe: async () => botMember, fetch: async () => new Collection() },
    };
    Object.assign(client, { guilds: { fetch: async () => guild } });
    const naming = { nameFormat: "{status} Role {slot}" };
    startStatsRoleSlots(client as unknown as Client, "guild", slots, naming,
        async () => { saves++; }, async () => {});
    const interaction = {
        isChatInputCommand: () => true,
        commandName: "stats-role",
        guildId: "guild",
        memberPermissions: new PermissionsBitField(PermissionFlagsBits.ManageGuild),
        options: { getSubcommand: () => "slot", getInteger: () => 1, getRole: () => role },
        deferReply: async () => {},
        editReply: async (reply: string | { content: string }) => { replies.push(typeof reply === "string" ? reply : reply.content); },
    };
    client.emit(Events.InteractionCreate, interaction);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(slots["1"], { roleId: role.id });
    assert.equal(saves, 1);
    assert.match(replies.at(-1)!, /mapped to/);
    botMember.permissions = new PermissionsBitField();
    client.emit(Events.InteractionCreate, interaction);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(saves, 1);
    assert.match(replies.at(-1)!, /Manage Roles permission:\*\* Missing/);
    client.emit(Events.InteractionCreate, {
        ...interaction,
        options: { getSubcommand: () => "config", getString: () => "{status} Stats #{slot}" },
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(saves, 2);
    assert.equal(naming.nameFormat, "{status} Stats #{slot}");
    assert.equal(role.name, "Unclaimed Stats #1");
    assert.equal(formatUnclaimedStatsRoleName(naming.nameFormat, "2", true), "Locked Stats #2");
});
