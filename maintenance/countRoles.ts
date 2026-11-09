import { writeFile } from "node:fs/promises";
import client from "../client.ts";

const guildId = "1216816878937313442";

try {
    const guild = await client.guilds.fetch(guildId);
    const roles = await guild.roles.fetch();
    await guild.members.fetch();

    const output = [...roles.values()]
        .sort((a, b) => b.comparePositionTo(a))
        .map(role => `${role.name} (${role.id}) — ${role.members.size} members`)
        .join("\n");

    await writeFile(new URL("./roles.txt", import.meta.url), `${output}\n`);

    console.log(`Wrote ${roles.size} roles (including @everyone) to maintenance/roles.txt.`);
} finally {
    await client.destroy();
}
