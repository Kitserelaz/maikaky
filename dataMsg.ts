import client from "./client.js";
import type { TextChannel, Snowflake } from "discord.js";

export const dataMsg = await (await client.channels.fetch("1327066650133925898") as TextChannel).messages.fetch("1327068250848235611");
const attachmentText = await (await fetch([...dataMsg.attachments.values()][0].url)).text()
export const dataContent = JSON.parse(attachmentText) as {
    submissions: {
        message: Snowflake,
        user: Snowflake,
        target: Snowflake,
        timestamp: number
    }[],
    current: {
        submissions: {
            message: Snowflake,
            user: Snowflake,
            target: Snowflake,
            timestamp: number
        }[],
        members: {
            id: Snowflake,
            displayName: string,
            username: string
        }[]
    },
    serverIndexes?: Record<Snowflake, {
        webhookId: Snowflake,
        webhookToken: string,
        messageIds: Snowflake[],
        roleId?: Snowflake
    }>,
    lastRun: string,
    activity: Record<Snowflake, {
        general: {
            status: Record<string, number>,
            chat: Record<string, number>,
            last: {
                status: string,
                chat: string
            }
        },
        workdays: {
            status: Record<string, number>,
            chat: Record<string, number>,
            last: {
                status: string,
                chat: string
            }
        },
        weekend: {
            status: Record<string, number>,
            chat: Record<string, number>,
            last: {
                status: string,
                chat: string
            }
        },
        weekdays: Record<string, {
            status: Record<string, number>,
            chat: Record<string, number>,
            last: {
                status: string,
                chat: string
            }
        }>,
    }>,
    lastStatusUpdate: string,
    lastDuolingo: {
        inviteToken: string,
        jwtToken: string,
        userId: number
    }
};
export const saveData = async () => await dataMsg.edit({
    "files": [
        {
            "attachment": Buffer.from(JSON.stringify(dataContent), "utf8"),
            "name": "data.json"
        }
    ]
});
