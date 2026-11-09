import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { drawHeadingText, layoutHeadingText } from "./headingText.ts";
import { drawHeadingWaves } from "./headingWaves.ts";
import { createHeadingPalette } from "./headingPalette.ts";
import { drawHeadingBacking } from "./headingBacking.ts";

// bun run maintenance/generateHeading.ts "配信スタート" heading.png --accent "#8b5cf6" --tilt --size-variation --wavy-lines
const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
        tilt: { type: "boolean" },
        "tilt-strength": { type: "string" },
        "size-variation": { type: "boolean", default: false },
        "wavy-lines": { type: "boolean", default: false },
        "legacy-white-backing": { type: "boolean", default: false },
        accent: { type: "string" },
    },
});
const [text, outputPath] = positionals;

if (positionals.length !== 2 || !text?.trim() || /[\r\n]/.test(text)) {
    throw new Error('Usage: bun run maintenance/generateHeading.ts "Single-line heading" output.png [--tilt] [--tilt-strength degrees] [--size-variation] [--wavy-lines] [--accent "#8b5cf6"] [--legacy-white-backing]');
}

const strengthOption = values["tilt-strength"];
const tiltStrength = strengthOption === undefined ? (values.tilt ? 4 : 0) : Number(strengthOption);

if (
    (strengthOption !== undefined && !strengthOption.trim()) ||
    !Number.isFinite(tiltStrength) || tiltStrength < 0
) {
    throw new Error("Tilt strength must be a finite, non-negative number of degrees.");
}

const palette = createHeadingPalette(values.accent);
const fontPath = fileURLToPath(new URL("../fot-yuruka-std.ttf", import.meta.url));

if (!GlobalFonts.registerFromPath(fontPath, "Yuruka")) {
    throw new Error(`Could not load font: ${fontPath}`);
}

const font = '160px "Yuruka"';
const padding = 40;
const measuringContext = createCanvas(1, 1).getContext("2d");
measuringContext.font = font;
const layout = layoutHeadingText(measuringContext, text, tiltStrength, values["size-variation"]);
const canvas = createCanvas(
    Math.ceil(layout.width + padding * 2),
    Math.ceil(layout.height + padding * 2),
);
const context = canvas.getContext("2d");

context.font = font;
context.lineJoin = "round";

drawHeadingBacking(context, layout, padding, palette, values["legacy-white-backing"]);

const gradient = context.createLinearGradient(0, padding, 0, padding + layout.height);
gradient.addColorStop(0, palette.fillTop);
gradient.addColorStop(1, palette.fillBottom);
context.fillStyle = gradient;
drawHeadingText(context, layout, "fillText", padding, padding);

if (values["wavy-lines"]) {
    drawHeadingWaves(context, layout, padding, palette.waves);
}

await writeFile(outputPath, await canvas.encode("png"));
console.log(`Wrote ${canvas.width}×${canvas.height} heading to ${outputPath}`);
