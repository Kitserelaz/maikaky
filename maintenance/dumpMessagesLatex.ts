import { readFile, writeFile } from "node:fs/promises";
import { escapeLatex, formatBody } from "./messageLatexFormatting.ts";

const channelId = "1217494766397296771";
const input = await readFile(`messages-${channelId}.txt`, "utf8");
const messages = [...input.matchAll(/^\[(\d{4}-\d{2}-\d{2}T[^\]]+)\] (.+?) \| ([^\n]*)\n([\s\S]*?)(?=^\[\d{4}-\d{2}-\d{2}T|(?![\s\S]))/gm)];
if (!messages.length) throw new Error("No messages found in the text export.");
const dateFormat = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC",
});
const monthFormat = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
let previousMonth = "";
const content = messages.map(([, timestamp, , author, body]) => {
    const month = monthFormat.format(new Date(timestamp));
    const heading = month !== previousMonth ? `\\section{${month}}\n` : "";
    previousMonth = month;
    return `${heading}\\Needspace{5\\baselineskip}
\\par\\vspace{1.2\\baselineskip}
{\\bfseries ${escapeLatex(author)}}\\hfill{\\small\\color{gray} ${dateFormat.format(new Date(timestamp))} UTC}\\par
\\nobreak\\smallskip\\nobreak
${formatBody(body)}`;
}).join("\n");

await writeFile(`messages-${channelId}.tex`, `\\documentclass[11pt]{article}
\\usepackage{fontspec}
\\usepackage[margin=0.85in]{geometry}
\\usepackage{xcolor,needspace,enumitem}
\\usepackage{xurl}
\\usepackage[unicode,colorlinks=true,urlcolor=blue!50!black,linkcolor=black]{hyperref}
\\setmainfont{Georgia}
\\newfontfamily\\unicodefont{Arial Unicode MS}
\\newfontfamily\\mathfont{STIXGeneral}
\\newcommand{\\archivechar}[1]{%
\\iffontchar\\font\"#1 \\char\"#1\\relax\\else
{\\unicodefont\\iffontchar\\font\"#1 \\char\"#1\\relax\\else
\\mathfont\\iffontchar\\font\"#1 \\char\"#1\\relax\\else
{\\scriptsize\\texttt{[U+#1]}}\\fi\\fi}\\fi}
\\setlength{\\parindent}{0pt}
\\setlength{\\emergencystretch}{3em}
\\setlist{nosep,leftmargin=1.5em,topsep=0.4em}
\\raggedright
\\begin{document}
{\\LARGE\\bfseries MGTV Message Archive}\\par\\medskip
Channel ${channelId}\\par
${messages.length} messages. All timestamps are in UTC.\\par
Unsupported Unicode symbols are shown as [U+code].\\par
\\tableofcontents
\\clearpage
${content}
\\end{document}
`, "utf8");
console.log(`Wrote ${messages.length} messages to messages-${channelId}.tex.`);
