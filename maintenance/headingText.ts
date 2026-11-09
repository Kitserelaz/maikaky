import type { SKRSContext2D } from "@napi-rs/canvas";

export const layoutHeadingText = (
    context: SKRSContext2D,
    text: string,
    tiltStrength: number,
    sizeVariation: boolean,
) => {
    const perCharacter = tiltStrength > 0 || sizeVariation;
    const characters = perCharacter
        ? Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text), part => part.segment)
        : [text];
    let seed = 2166136261;

    for (const character of text) {
        seed = Math.imul(seed ^ character.codePointAt(0)!, 16777619) >>> 0;
    }

    const gap = perCharacter ? 4 : 0;
    let cursor = 0;
    let top = Infinity;
    let bottom = -Infinity;
    const charactersWithPositions = characters.map(character => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;

        // Enlarge roughly one in three characters by 3–5%, repeatably.
        const sizeSeed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const enlargement = sizeSeed % 3 === 0 ? 0.03 + sizeSeed / 2 ** 32 * 0.02 : 0;
        const scale = sizeVariation ? 1 + enlargement : 1;
        const bounds = context.measureText(character);
        const inkWidth = (bounds.actualBoundingBoxLeft + bounds.actualBoundingBoxRight) * scale;
        const inkHeight = (bounds.actualBoundingBoxAscent + bounds.actualBoundingBoxDescent) * scale;
        const centerX = (bounds.actualBoundingBoxRight - bounds.actualBoundingBoxLeft) / 2;
        const centerY = (bounds.actualBoundingBoxDescent - bounds.actualBoundingBoxAscent) / 2;

        const angle = (seed / 2 ** 32 * 2 - 1) * tiltStrength * Math.PI / 180;
        const cosine = Math.abs(Math.cos(angle));
        const sine = Math.abs(Math.sin(angle));
        const rotatedWidth = inkWidth * cosine + inkHeight * sine;
        const rotatedHeight = inkWidth * sine + inkHeight * cosine;
        const width = perCharacter ? Math.max(bounds.width * scale, rotatedWidth) : inkWidth;
        const characterPosition = {
            text: character,
            x: cursor + width / 2,
            y: centerY * scale,
            angle,
            scale,
            offsetX: -centerX,
            offsetY: -centerY,
        };

        cursor += width + gap;
        top = Math.min(top, centerY * scale - rotatedHeight / 2);
        bottom = Math.max(bottom, centerY * scale + rotatedHeight / 2);
        return characterPosition;
    });

    return {
        width: cursor - gap,
        height: bottom - top,
        characters: charactersWithPositions.map(character => ({ ...character, y: character.y - top })),
    };
};

export const drawHeadingText = (
    context: SKRSContext2D,
    layout: ReturnType<typeof layoutHeadingText>,
    operation: "strokeText" | "fillText",
    x: number,
    y: number,
) => {
    for (const character of layout.characters) {
        context.save();
        context.translate(x + character.x, y + character.y);
        context.rotate(character.angle);
        context.scale(character.scale, character.scale);
        context[operation](character.text, character.offsetX, character.offsetY);
        context.restore();
    }
};
