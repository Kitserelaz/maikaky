import client from "./client.ts";
import { Events } from "discord.js";
import type { Snowflake, GuildMember } from "discord.js";
import { dataContent, saveData } from "./dataMsg.ts"
import ChartJsImage from "chartjs-to-image";

const getCurrentHour = () => (new Date()).getUTCFullYear() + "-" + (new Date()).getUTCMonth() + "-" + (new Date()).getUTCDate()+ " " + (new Date()).getUTCHours();
const getHourNumber = () => (new Date()).getUTCHours();
const getWeekdayNumber = () => (new Date()).getUTCDay();

const updateActivity = async (userId: Snowflake, kind: "status" | "chat") => {
    dataContent.activity[userId] ??= {
        general: {
            status: {},
            chat: {},
            last: {
                status: "",
                chat: ""
            },
        },
        workdays: {
            status: {},
            chat: {},
            last: {
                status: "",
                chat: ""
            },
        },
        weekend: {
            status: {},
            chat: {},
            last: {
                status: "",
                chat: ""
            },
        },
        weekdays: {},
    };
    const currentUser = dataContent.activity[userId];
    if (currentUser.general.last[kind] !== getCurrentHour()) {
        currentUser.general[kind][getHourNumber()] ??= 0;
        currentUser.general[kind][getHourNumber()] += 1;
        currentUser.general.last[kind] = getCurrentHour();
    };
    if (getWeekdayNumber() > 0 && getWeekdayNumber() < 6) {
        if (currentUser.weekend.last[kind] !== getCurrentHour()) {
            currentUser.weekend[kind][getHourNumber()] ??= 0;
            currentUser.weekend[kind][getHourNumber()] += 1;
            currentUser.weekend.last[kind] = getCurrentHour();
        };
    } else {
        if (currentUser.workdays.last[kind] !== getCurrentHour()) {
            currentUser.workdays[kind][getHourNumber()] ??= 0;
            currentUser.workdays[kind][getHourNumber()] += 1;
            currentUser.workdays.last[kind] = getCurrentHour();
        };
    }
    if (currentUser.weekdays[getWeekdayNumber()]?.last[kind] !== getCurrentHour()) {
        currentUser.weekdays[getWeekdayNumber()] ??= {
            status: {},
            chat: {},
            last: {
                status: "",
                chat: ""
            },
        };
        currentUser.weekdays[getWeekdayNumber()][kind][getHourNumber()] ??= 0;
        currentUser.weekdays[getWeekdayNumber()][kind][getHourNumber()] += 1;
        currentUser.weekdays[getWeekdayNumber()].last[kind] = getCurrentHour();
    };
}

const newHour = async () => {
    for (const [id, oauthGuild] of await client.guilds.fetch()) {
        const guild = await oauthGuild.fetch();
        for (const presence of guild.presences.cache.values()) {
            if (presence.status === "offline") continue;
            updateActivity(presence.userId, "status");
        }
    }
    dataContent.lastStatusUpdate = getCurrentHour();
    await saveData();
}

if (dataContent.lastStatusUpdate !== getCurrentHour()) newHour();

const getMillisecondsUntilNextHour = () => {
    const now = new Date();
    const nextHour = new Date();
    nextHour.setMinutes(60, 0, 0)
    const millisecondsUntilNextHour = nextHour.getTime() - now.getTime();
    return millisecondsUntilNextHour;
}

setTimeout(() => {
    newHour();
    setInterval(newHour, 60 * 60 * 1000)
}, getMillisecondsUntilNextHour())

client.on(Events.PresenceUpdate, async presence => {
    if (!presence) return;
    if (presence.status === "offline") return;
    updateActivity(presence.userId, "status");
});

client.on(Events.MessageCreate, async message => {
    if (!message) return;
    if (message.webhookId) return;
    updateActivity(message.author.id, "chat");
});

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "activity_chart") return;
    const data = dataContent.activity[(interaction.options.getMember("member") as GuildMember).id]?.general[interaction.options.getString("category") as "status" | "chat"];
    if (!data) return await interaction.reply("No data.")
    const hours: Record<string, number> = {};
    for (let i = 0; i < 24; i++) {
        hours[i] = data[i] ?? 0;
    }
    const chart = new ChartJsImage();
    chart.setConfig({
      type: "bar",
      data: { labels: Object.keys(hours), datasets: [{ label: "Hours", data: Object.values(hours) }] },
    });
    await interaction.reply({
        "files": [
            {
                "attachment": await chart.toBinary(),
                "name": "chart.png"
            }
        ]
    });
});
