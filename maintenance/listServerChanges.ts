import { writeFile } from "node:fs/promises";
import { AuditLogEvent, REST, Routes } from "discord.js";
import type {
    APIAuditLogEntry,
    RESTGetAPIGuildChannelsResult,
    RESTGetAPIGuildResult,
    RESTGetAPIGuildRolesResult,
    RESTGetAPIAuditLogResult,
} from "discord-api-types/v10";

// One-time, read-only export: bun maintenance/listServerChanges.ts
const guildId = "1216816878937313442";
const since = new Date("2026-11-02T00:00:00-07:00");
const until = new Date();
const token = process.env.token;
if (!token) throw new Error("Missing token in .env");

const rest = new REST({ version: "10" }).setToken(token);
const [guild, channels, roles] = await Promise.all([
    rest.get(Routes.guild(guildId)) as Promise<RESTGetAPIGuildResult>,
    rest.get(Routes.guildChannels(guildId)) as Promise<RESTGetAPIGuildChannelsResult>,
    rest.get(Routes.guildRoles(guildId)) as Promise<RESTGetAPIGuildRolesResult>,
]);
const entries: APIAuditLogEntry[] = [];
const names = new Map([
    [guild.id, guild.name],
    ...channels.map(channel => [channel.id, channel.name] as const),
    ...roles.map(role => [role.id, role.name] as const),
]);
let before = ((BigInt(until.getTime() - 1420070400000) << 22n)).toString();

while (true) {
    const page = await rest.get(Routes.guildAuditLog(guildId), {
        query: new URLSearchParams({ limit: "100", before }),
    }) as RESTGetAPIAuditLogResult;

    for (const user of page.users ?? []) names.set(user.id, user.username);
    for (const thread of page.threads ?? []) names.set(thread.id, thread.name);
    for (const entry of page.audit_log_entries) {
        const timestamp = Number((BigInt(entry.id) >> 22n) + 1420070400000n);
        if (timestamp >= since.getTime()) entries.push(entry);
    }

    console.log(`Read ${entries.length} audit entries since November 2.`);
    const oldest = page.audit_log_entries.at(-1);
    if (!oldest || Number((BigInt(oldest.id) >> 22n) + 1420070400000n) < since.getTime()) break;
    before = oldest.id;
}

entries.reverse();
const output = {
    guild: { id: guild.id, name: guild.name },
    since: since.toISOString(),
    until: until.toISOString(),
    timezone: "America/Vancouver",
    names: Object.fromEntries(names),
    entries: entries.map(entry => ({
        ...entry,
        timestamp: new Date(Number((BigInt(entry.id) >> 22n) + 1420070400000n)).toISOString(),
        action: AuditLogEvent[entry.action_type] ?? String(entry.action_type),
    })),
};

await writeFile(new URL("./server-changes-2026-11-02.json", import.meta.url), `${JSON.stringify(output, null, 2)}\n`);
console.log(`Exported ${entries.length} entries for ${guild.name} to maintenance/server-changes-2026-11-02.json.`);
