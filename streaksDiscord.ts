import { Routes, WebhookClient, type APIMessage } from "discord.js";

const channelId = "1327066650133925898";
const chunkSize = 16 * 1024 * 1024;
export const streaksDataMessageId = "1568796336760029304";

type Manifest = {
    bytes: number;
    parts: { messageId: string; filename: string }[];
};

let webhook: WebhookClient | undefined;
let channelVerified = false;

const getWebhook = () => {
    if (!webhook) {
        const url = process.env.dataWebhook;
        if (!url) throw new Error("dataWebhook is required for streak storage.");
        try {
            webhook = new WebhookClient({ url });
        } catch {
            throw new Error("dataWebhook must be a valid Discord webhook URL.");
        }
    }
    return webhook;
};

const webhookRequest = async <T>(operation: () => Promise<T>): Promise<T> => {
    try {
        return await operation();
    } catch (error) {
        const code = (error as { code?: unknown }).code;
        throw new Error(`Streak storage webhook request failed${typeof code === "number" ? ` (Discord code ${code})` : ""}.`);
    }
};

const verifiedWebhook = async () => {
    const client = getWebhook();
    if (!channelVerified) {
        const info = await webhookRequest(() => client.rest.get(Routes.webhook(client.id, client.token), { auth: false })) as { channel_id: string };
        if (info.channel_id !== channelId) throw new Error(`dataWebhook must target channel ${channelId}.`);
        channelVerified = true;
    }
    return client;
};

export const isStreakStorageMessage = (message: { webhookId: string | null }) =>
    message.webhookId !== null && message.webhookId === webhook?.id;

const readAttachment = async (message: APIMessage, filename: string) => {
    if (message.channel_id !== channelId) throw new Error("Streak storage message is in the wrong channel.");
    const attachment = message.attachments.find(item => item.filename === filename);
    if (!attachment) throw new Error(`Streak storage attachment missing: ${filename}.`);
    try {
        const response = await fetch(attachment.url);
        if (!response.ok) throw new Error();
        return Buffer.from(await response.arrayBuffer());
    } catch {
        throw new Error("Could not download a streak storage attachment.");
    }
};

const readManifest = async (message: APIMessage): Promise<Manifest> => {
    const manifest = JSON.parse((await readAttachment(message, "manifest.json")).toString("utf8"));
    if (!Number.isSafeInteger(manifest.bytes) || manifest.bytes < 1
        || !Array.isArray(manifest.parts)
        || !manifest.parts.every((part: Manifest["parts"][number]) =>
            part && typeof part.messageId === "string" && /^\d+$/.test(part.messageId) && typeof part.filename === "string")) {
        throw new Error("Invalid streak storage manifest.");
    }
    return manifest;
};

export const loadDiscordStreakSnapshot = async () => {
    const client = await verifiedWebhook();
    const root = await webhookRequest(() => client.fetchMessage(streaksDataMessageId));
    const manifest = await readManifest(root);
    const chunks: Buffer[] = [];
    for (const part of manifest.parts) {
        const message = await webhookRequest(() => client.fetchMessage(part.messageId));
        chunks.push(await readAttachment(message, part.filename));
    }
    const bytes = Buffer.concat(chunks);
    if (bytes.length !== manifest.bytes) throw new Error("Streak snapshot byte length does not match its manifest.");
    const snapshot = bytes.toString("utf8");
    JSON.parse(snapshot);
    console.log(`[streaks] Loaded ${bytes.length} bytes from ${chunks.length} Discord chunk(s).`);
    return snapshot;
};

const publishSnapshot = async (snapshot: string, root?: APIMessage) => {
    const client = await verifiedWebhook();
    const previous = root ? await readManifest(root) : undefined;
    const bytes = Buffer.from(snapshot, "utf8");
    const count = Math.ceil(bytes.length / chunkSize);
    const manifest: Manifest = {
        bytes: bytes.length,
        parts: [],
    };

    for (let index = 0; index < count; index++) {
        const filename = count === 1 ? "streaks.json" : `streaks.part-${index + 1}.bin`;
        console.log(`[streaks] Uploading Discord chunk ${index + 1}/${count}.`);
        const message = await webhookRequest(() => client.send({
            content: `Streak history chunk ${index + 1}/${count}`,
            allowedMentions: { parse: [] },
            files: [{ attachment: bytes.subarray(index * chunkSize, (index + 1) * chunkSize), name: filename }],
        }));
        manifest.parts.push({ messageId: message.id, filename });
    }

    console.log(`[streaks] Publishing ${count} chunk(s), ${bytes.length} bytes, to the streak data message.`);
    const payload = {
        content: "Streak history manifest — data chunks are in separate messages",
        allowedMentions: { parse: [] },
        attachments: [],
        files: [
            { attachment: Buffer.from(JSON.stringify(manifest), "utf8"), name: "manifest.json" },
        ],
    };
    const published = await webhookRequest(() => root ? client.editMessage(root.id, payload) : client.send(payload));

    for (const part of previous?.parts ?? []) {
        try {
            await webhookRequest(() => client.deleteMessage(part.messageId));
        } catch (error) {
            console.error(`[streaks] Snapshot published, but old chunk ${part.messageId} could not be removed:`, error);
        }
    }
    return published.id;
};

export const createDiscordStreakSnapshot = async (snapshot: string) => publishSnapshot(snapshot);

export const saveDiscordStreakSnapshot = async (snapshot: string) => {
    const client = await verifiedWebhook();
    const root = await webhookRequest(() => client.fetchMessage(streaksDataMessageId));
    await publishSnapshot(snapshot, root);
};
