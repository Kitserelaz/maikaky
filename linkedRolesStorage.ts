import type { TextChannel } from "discord.js";
import { decryptLinkedRolesData, encryptLinkedRolesData } from "./linkedRolesEncryption.ts";

export type LinkedRolesTokens = {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
};

const attachmentName = "linked-roles-tokens.enc";

const getTokenMessage = async (channel: TextChannel, messageId: string) => {
    if (!messageId || !/^\d+$/.test(messageId)) {
        throw new Error("The token message ID must identify the encrypted token data message.");
    }
    const message = await channel.messages.fetch({ message: messageId, force: true });
    if (message.author.id !== channel.client.user!.id || !message.attachments.some(attachment => attachment.name === attachmentName)) {
        throw new Error("Linked Roles token storage must be a dedicated bot-authored message with an encrypted attachment.");
    }
    return message;
};

export const loadLinkedRolesTokens = async (channel: TextChannel, messageId: string): Promise<Record<string, LinkedRolesTokens>> => {
    const message = await getTokenMessage(channel, messageId);
    const attachment = message.attachments.find(item => item.name === attachmentName)!;
    const response = await fetch(attachment.url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`Could not download encrypted Linked Roles tokens (HTTP ${response.status}).`);
    return JSON.parse(decryptLinkedRolesData(Buffer.from(await response.arrayBuffer())));
};

export const saveLinkedRolesTokens = async (channel: TextChannel, messageId: string, tokens: Record<string, LinkedRolesTokens>) => {
    const encrypted = encryptLinkedRolesData(JSON.stringify(tokens));
    const message = await getTokenMessage(channel, messageId);
    await message.edit({
        attachments: [],
        files: [{ attachment: encrypted, name: attachmentName }],
    });
};
