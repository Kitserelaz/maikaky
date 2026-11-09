import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import { drawHeadingText, type layoutHeadingText } from "./headingText.ts";

export const drawHeadingWaves = (
    context: SKRSContext2D,
    layout: ReturnType<typeof layoutHeadingText>,
    padding: number,
    color: string,
) => {
    const { width, height } = context.canvas;
    const waves = createCanvas(width, height);
    const wavesContext = waves.getContext("2d");
    wavesContext.strokeStyle = color;
    wavesContext.lineCap = "round";
    wavesContext.lineJoin = "round";

    const waveThickness = Math.max(1, layout.height / 3);
    let row = 0;

    for (let baseline = 0; baseline < height + 12; baseline += waveThickness * (2 + Math.sin(row * 1.3) * 0.15)) {
        wavesContext.lineWidth = waveThickness * (1 + Math.sin(row * 2.1) * 0.15);
        wavesContext.beginPath();
        let previousX = -32;
        let previousY = baseline;
        wavesContext.moveTo(previousX, previousY);

        for (let x = -16; x <= width + 32; x += 16) {
            // Smoothly alternate between calmer and stronger areas.
            const intensity = 0.4 + (Math.sin(x / 90 + baseline / 70) + 1) * 0.6;
            const wave = Math.sin(x / 24 + row * 1.7) * 10 + Math.sin(x / 11 + row) * 2;
            const y = baseline + wave * intensity;
            wavesContext.quadraticCurveTo(previousX, previousY, (previousX + x) / 2, (previousY + y) / 2);
            previousX = x;
            previousY = y;
        }

        wavesContext.stroke();
        row += 1;
    }

    const mask = createCanvas(width, height);
    const maskContext = mask.getContext("2d");
    maskContext.font = context.font;
    maskContext.fillStyle = "#ffffff";
    drawHeadingText(maskContext, layout, "fillText", padding, padding);

    // Apply the complete glyph mask to the complete pattern in one operation.
    wavesContext.globalCompositeOperation = "destination-in";
    wavesContext.drawImage(mask, 0, 0);
    context.drawImage(waves, 0, 0);
};
