import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ContainerBuilder, MessageFlags, TextDisplayBuilder } from "discord.js";
import type { SendableChannels } from "discord.js";
import { parseRoleGuide } from "./maintenance/roleGuideUtils.ts";

export const postRoleInformation = async (channel: SendableChannels) => {
    const guide = parseRoleGuide(await readFile(new URL("./maintenance/roleGuide.txt", import.meta.url), "utf8"));
    const sections = guide.sections.filter(section => section.name !== "Excluded");
    const headingsDirectory = await mkdtemp(join(tmpdir(), "role-information-"));
    const allowedMentions = { parse: [], repliedUser: false };

    try {
        const headings: string[] = [];
        for (const [index, section] of sections.entries()) {
            const outputPath = join(headingsDirectory, `${index + 1}.png`);
            const generator = Bun.spawn([
                process.execPath,
                "run",
                fileURLToPath(new URL("./maintenance/generateHeading.ts", import.meta.url)),
                section.name,
                outputPath,
                "--accent", section.accent,
                "--tilt",
                "--size-variation",
                "--wavy-lines",
                "--legacy-white-backing",
            ], { stdout: "inherit", stderr: "inherit" });

            if (await generator.exited !== 0) {
                throw new Error(`Heading generation failed: ${section.name}`);
            }
            headings.push(outputPath);
        }

        for (const content of guide.intro) {
            await channel.send({
                components: [new TextDisplayBuilder().setContent(content)],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions,
            });
        }

        for (const [index, section] of sections.entries()) {
            for (const [messageIndex, content] of section.messages.entries()) {
                const container = new ContainerBuilder()
                    .setAccentColor(Number.parseInt(section.accent.slice(1), 16));

                if (messageIndex === 0) {
                    container.addMediaGalleryComponents(gallery => gallery.addItems(item => item
                        .setURL(`attachment://${index + 1}.png`)
                        .setDescription(section.name)));
                }

                container.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
                await channel.send({
                    components: [container],
                    files: messageIndex === 0 ? [headings[index]!] : [],
                    flags: MessageFlags.IsComponentsV2,
                    allowedMentions,
                });
            }
            console.log(`Sent ${section.name}.`);
        }
    } finally {
        await rm(headingsDirectory, { recursive: true, force: true });
    }
};
