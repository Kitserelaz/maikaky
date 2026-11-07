const escapes: Record<string, string> = {
    "\\": "\\textbackslash{}", "{": "\\{", "}": "\\}", "$": "\\$",
    "&": "\\&", "#": "\\#", "%": "\\%", "_": "\\_",
    "^": "\\textasciicircum{}", "~": "\\textasciitilde{}",
};

export const escapeLatex = (text: string): string => [...text].map(character => {
    if (/[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/.test(character)) return "";
    if (escapes[character]) return escapes[character];
    const code = character.codePointAt(0)!;
    return code > 127 ? `\\archivechar{${code.toString(16).toUpperCase()}}` : character;
}).join("");

export const formatInline = (text: string): string => {
    if (/^\S{80,}$/.test(text) && !text.startsWith("http")) {
        return `\\nolinkurl{${text.replace(/[\\{}%#]/g, character => `\\${character}`)}}`;
    }
    const cleaned = text
        .replace(/<a?:([^:>]+):\d+>/g, ":$1:")
        .replace(/<@&(\d+)>/g, "@role[$1]")
        .replace(/<@!?(\d+)>/g, "@user[$1]")
        .replace(/<#(\d+)>/g, "#channel[$1]");
    // ponytail: only the Discord inline formatting used here; use a Markdown parser for nested markup.
    const tokens = /<?https?:\/\/[^\s<>]+>?|\*\*(.+?)\*\*|__(.+?)__|\*([^*\n]+)\*|`([^`\n]+)`/g;
    let result = "";
    let offset = 0;
    for (const match of cleaned.matchAll(tokens)) {
        result += escapeLatex(cleaned.slice(offset, match.index));
        if (/^<?https?:/.test(match[0])) {
            const url = match[0].replace(/^<|>$/g, "");
            result += `\\url{${url.replace(/[\\{}%#]/g, character => `\\${character}`)}}`;
        } else {
            const command = match[1] ? "textbf" : match[2] ? "underline" : match[3] ? "emph" : "texttt";
            result += `\\${command}{${escapeLatex(match[1] ?? match[2] ?? match[3] ?? match[4])}}`;
        }
        offset = match.index! + match[0].length;
    }
    return result + escapeLatex(cleaned.slice(offset));
};

export const formatBody = (body: string): string => {
    const output: string[] = [];
    let list: string | undefined;
    for (const line of body.trim().split("\n")) {
        const bullet = line.match(/^\s*[-*]\s+(.+)/);
        const numbered = line.match(/^\s*\d+[.)]\s+(.+)/);
        const nextList = bullet ? "itemize" : numbered ? "enumerate" : undefined;
        if (list !== nextList) {
            if (list) output.push(`\\end{${list}}`);
            if (nextList) output.push(`\\begin{${nextList}}`);
            list = nextList;
        }
        if (bullet || numbered) output.push(`\\item ${formatInline((bullet ?? numbered)![1])}`);
        else if (/^#{1,3}\s/.test(line)) output.push(`\\par\\smallskip{\\large\\bfseries ${formatInline(line.replace(/^#+\s+/, ""))}}\\par\\smallskip`);
        else if (/^={5,}$/.test(line.trim())) output.push("\\par\\smallskip\\hrule\\smallskip");
        else output.push(line.trim() ? `${formatInline(line)}\\par` : "\\smallskip");
    }
    if (list) output.push(`\\end{${list}}`);
    return output.join("\n");
};
