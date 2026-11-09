export const splitGuideMessages = (text: string) => {
    const messages: string[] = [];
    let current = "";

    for (const line of text.trim().split("\n")) {
        if (line.length > 4000) {
            throw new Error("A role guide line exceeds Discord's 4000-character Components V2 limit.");
        }

        const next = current ? `${current}\n${line}` : line;
        if (next.length > 4000) {
            messages.push(current);
            current = line;
        } else {
            current = next;
        }
    }

    if (current.trim()) messages.push(current);
    return messages;
};

export const parseRoleGuide = (text: string) => {
    const [intro, ...blocks] = text.split(/^## /m);
    if (!blocks.length) throw new Error("No sections found in roleGuide.txt.");

    const sections = blocks.map(block => {
        const [heading, ...lines] = block.split("\n");
        const match = /^(.+?) — (#[\da-f]{6})$/i.exec(heading!.trim());
        if (!match) throw new Error(`Invalid heading or accent: ${heading}`);

        const messages = splitGuideMessages(lines.join("\n"));
        if (!messages.length) throw new Error(`Empty section: ${heading}`);

        return { name: match[1]!, accent: match[2]!, messages };
    });

    return { intro: splitGuideMessages(intro!), sections };
};
