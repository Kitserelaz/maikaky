import { createCanvas, type Canvas, type SKRSContext2D } from "@napi-rs/canvas";
import { drawHeadingText, type layoutHeadingText } from "./headingText.ts";
import type { createHeadingPalette } from "./headingPalette.ts";

const fillBackingGaps = (
    context: SKRSContext2D,
    bridgeDistance: number,
    wordBreaks: number[],
    roundJoins: boolean,
) => {
    const { width, height } = context.canvas;
    const image = context.getImageData(0, 0, width, height);

    // Fill deeper notches between letters without bridging a word space.
    for (let y = 0; y < height; y += 1) {
        let previousX = -1;

        for (let x = 0; x < width; x += 1) {
            const pixel = y * width + x;
            if (image.data[pixel * 4 + 3] !== 255) continue;

            if (
                previousX >= 0 && x - previousX <= bridgeDistance &&
                !wordBreaks.some(wordBreak => wordBreak > previousX && wordBreak < x)
            ) {
                image.data.fill(255, (y * width + previousX + 1) * 4, pixel * 4);
            }

            previousX = x;
        }
    }

    const outside = new Uint8Array(width * height);
    const queue = new Uint32Array(width * height);
    let head = 0;
    let tail = 0;
    const visit = (pixel: number) => {
        if (outside[pixel] || image.data[pixel * 4 + 3] === 255) return;
        outside[pixel] = 1;
        queue[tail++] = pixel;
    };

    // Padding keeps the corner connected to the transparent exterior.
    visit(0);

    while (head < tail) {
        const pixel = queue[head++];
        const x = pixel % width;
        if (x > 0) visit(pixel - 1);
        if (x < width - 1) visit(pixel + 1);
        if (pixel >= width) visit(pixel - width);
        if (pixel < width * (height - 1)) visit(pixel + width);
    }

    for (let pixel = 0; pixel < outside.length; pixel += 1) {
        if (!outside[pixel]) {
            image.data.fill(255, pixel * 4, pixel * 4 + 4);
        }
    }

    context.putImageData(image, 0, 0);

    if (!roundJoins) return;

    // Round the filled joins, then restore a crisp, antialiased edge.
    const rounded = createCanvas(width, height);
    const roundedContext = rounded.getContext("2d");
    roundedContext.filter = "blur(3px)";
    roundedContext.drawImage(context.canvas, 0, 0);
    const roundedImage = roundedContext.getImageData(0, 0, width, height);

    for (let offset = 3; offset < roundedImage.data.length; offset += 4) {
        roundedImage.data[offset] = Math.max(0, Math.min(255, (roundedImage.data[offset] - 128) * 8 + 128));
    }

    context.putImageData(roundedImage, 0, 0);
};

export const drawHeadingBacking = (
    context: SKRSContext2D,
    layout: ReturnType<typeof layoutHeadingText>,
    padding: number,
    palette: ReturnType<typeof createHeadingPalette>,
    legacyWhiteBacking: boolean,
) => {
    const { width, height } = context.canvas;
    const backing = createCanvas(width, height);
    const backingContext = backing.getContext("2d");
    backingContext.font = context.font;
    backingContext.lineJoin = "round";
    backingContext.lineWidth = 18;
    backingContext.fillStyle = "#ffffff";
    backingContext.strokeStyle = "#ffffff";
    drawHeadingText(backingContext, layout, "strokeText", padding, padding);
    drawHeadingText(backingContext, layout, "fillText", padding, padding);

    const wordBreaks = legacyWhiteBacking ? [] : layout.characters.flatMap(character => {
        if (/^\s+$/.test(character.text)) return [padding + character.x];

        return Array.from(character.text.matchAll(/\s+/g), space => {
            const prefixWidth = context.measureText(character.text.slice(0, space.index)).width;
            const spaceWidth = context.measureText(space[0]).width;
            return padding + character.x + character.offsetX + prefixWidth + spaceWidth / 2;
        });
    });

    fillBackingGaps(
        backingContext,
        legacyWhiteBacking ? 18 : Math.max(36, layout.height / 3),
        wordBreaks,
        !legacyWhiteBacking,
    );

    // Extend the filled silhouette by the existing 7px outer border.
    const outline = createCanvas(width, height);
    const outlineContext = outline.getContext("2d");
    outlineContext.drawImage(backing, 0, 0);

    for (let step = 0; step < 32; step += 1) {
        const angle = step / 32 * Math.PI * 2;
        outlineContext.drawImage(backing, Math.cos(angle) * 7, Math.sin(angle) * 7);
    }

    const layer = createCanvas(width, height);
    const layerContext = layer.getContext("2d");
    const paintMask = (mask: Canvas, color: string, x: number, y: number) => {
        layerContext.clearRect(0, 0, width, height);
        layerContext.globalCompositeOperation = "source-over";
        layerContext.drawImage(mask, 0, 0);
        layerContext.globalCompositeOperation = "source-in";
        layerContext.fillStyle = color;
        layerContext.fillRect(0, 0, width, height);
        context.drawImage(layer, x, y);
    };

    paintMask(outline, palette.shadow, 6, 10);
    paintMask(outline, palette.outline, 0, 0);
    paintMask(backing, palette.innerOutline, 0, 0);
};
