import { clampChroma, converter, formatRgb } from "culori";

const toOklch = converter("oklch");

export const createHeadingPalette = (accent: string | undefined) => {
    if (accent === undefined) {
        return {
            fillTop: "#ff75bf",
            fillBottom: "#ffe0b2",
            outline: "#8850b5",
            innerOutline: "#ffffff",
            shadow: "#39204f",
            waves: "rgba(255, 250, 224, 0.55)",
        };
    }

    if (!/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(accent)) {
        throw new Error("Accent must be a hex color with 3 or 6 digits, such as #8b5cf6.");
    }

    const color = toOklch(accent)!;
    const tone = (lightness: number, chromaScale: number, alpha = 1) => formatRgb(clampChroma({
        ...color,
        l: lightness,
        c: color.c * chromaScale,
        alpha,
    }, "oklch"))!;

    return {
        fillTop: tone(Math.min(0.8, Math.max(0.68, color.l + 0.05)), 0.85),
        fillBottom: tone(0.88, 0.35),
        outline: tone(0.44, 1.05),
        innerOutline: tone(0.985, 0.05),
        shadow: tone(0.25, 0.65),
        waves: tone(0.99, 0.08, 0.55),
    };
};
