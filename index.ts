import client from "./client.ts";
import "./webserver.ts";
import { dataContent, saveData } from "./dataMsg.ts"
import { Routes, ApplicationCommandType, ApplicationCommandOptionType, Events, ApplicationIntegrationType, InteractionContextType, MessageFlags, DiscordAPIError, TextChannel, GuildMember } from "discord.js";
import type { RESTPutAPIApplicationCommandsJSONBody, PollAnswerData, Message } from "discord.js"
import "./activity.ts";
import { serverIndexCommands } from "./serverIndexSetup.ts";
import { styleText } from "./formatting.ts";
import JSZip from "jszip";

client.setMaxListeners(0);

const targetChannel = await client.channels.fetch("1327068800931070064") as TextChannel;
const dataChannel = await client.channels.fetch("1327066650133925898") as TextChannel;
const getCurrentDate = () => (new Date()).getUTCFullYear() + "-" + (new Date()).getUTCMonth() + "-" + (new Date()).getUTCDate();

const generateDuolingoInvite = async () => {
    const userCreationResponse = await fetch("https://www.duolingo.com/2017-06-30/users?fields=id", {
        "headers": {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0",
            "Accept": "application/json; charset=UTF-8",
            "Accept-Language": "en-CA,en-US;q=0.7,en;q=0.3",
            "X-Amzn-Trace-Id": "User=0",
            "X-Requested-With": "XMLHttpRequest",
            "Content-Type": "application/json; charset=UTF-8"
        },
        "referrer": "https://www.duolingo.com/register",
        "body": "{\"distinctId\":\"0f678ecb-6de9-4c08-96da-26eed68f8e22\",\"signal\":{\"siteKey\":\"6LcLOdsjAAAAAFfwGusLLnnn492SOGhsCh-uEAvI\",\"token\":\"03AFcWeA6ngV7TPcJ0KPAeWzzxiR2tSmcNCCAg9iSy0bzOfyIhpZCVEanqYYp1LS5jXDhODeJUY-G1TRBUiHG9dFZNe3C94ETKHKfIRHZxCadqRtbW4C8_KseSMMFrRr0iQ0QrwsmqOpvwkx5ChUZgLcFW66u_DI9tTyCoZu6JeSIpyMejbvC250uoq_4tflvynpsFbar1DW6swOAlARSzuED_rt6brSSPDboVJD6yO_P4TprjQCdw28GxyvIDteqjRVlpHgvBBiAHJz_XEn9rCQRnWqu_kgTdDHoLKdqOUtJZ7sd8jKCiZgpEYgafRwHqTF7_NtX35MjMrEWjQd76ZNQIfUUP2wmzGxDPD3ORSLokYJ-mLGo1nfNWG3390otQaMwsV5IzGNhf2vbR4A8bmiqkMoO6vQussNRoCw-dkhF0Md3KBRdC7PdWhtcDAL0AhtYuciERa5PZT1nFTCsmzt6e4tW7sfM-gZ27zcZOvIfjRJGLQL51FFjYW4GIDtZiSnWhbkLP5BNU_6BpDSBqDVLxceY1vqJsKt9deuScZ5YAMxIdffhPd2y4BU4gYOKbGjNSzL0LPuylVOWJL5QGc99-5bWKKEQaeHsQ5c9NssIZs9RbEG6CuVwMgREt_M1jPFi_1CVfChZVirfX5Ee2Z0a9l5bGyZUtg4Md4WfJ8JAtfCaIZvNrNbpFaTBzCu5ZPLvPnMYIfljvbJnF7hJYwAr1CM31ZmEe5UCCdCsjLe-tTYtCp6s5SZGgZ53xkht6Y-hO76EK80MJYkGKHyk16KQxeIlsfDhriE75VhAQUX9h8SqpCxUIRXvU1KtNx8zPln6uNKjfxKlwoF0kWYYykWHuUDC1hQYelOMQOhaq2Gck7sAOxO9NWjs7tCaOxLu9EaeCpEhkLUXvhQ8Nn9-xhRhK9MYgUYrnoKCisqgPvfzaZbTRA94AZ9fZ2KDUaVcMKqmg1ebf7vOyiFOTMUhWHHJ38r9EvODuNVnRTzYLwtCYUyvIQYe32CnVH-SO9Cmda4ULKvtO_GcfChPJnNx7O2ftfCy4WS2IZymbRpTBwJ5TO6cS__DO9myNkxScqk7jgRL0Ck-AAh5VEn3ZPiYpGQ92Ee5Recubq5Hx2dffMqrlfl00xFdCw8kMDtVN3V_BjqVQ_aXutkb6rLkdiOKnjiCwPxvMRqkUkUj_k8GqSJhd9AUaOj4LX3Qzpk7hEmOhH54skv5Uoy8oqvqKwun3Z4_Y1LNZTa8keTIHpkq2EjDW4xyOiwOByz_OSa1Cgx_ytk764cdnl22-5R21K_ppnUFGe9QY6B2K7iRrAO2UMpchiKaXKdIfCY0Ev5BhVQ4uSJQIFtlmDEmUFmvPyM7lS6juElfHj_T36FuyiQts-XCEdwk_rGob2jdB3AJffYSXg6Y-EWumXEWdDy0HdWTBOvfrHLjXzIZwP3WGc8NQauy0MrdM8Okmg6dlUmXhKlffhi2qzUawx7ie-1VfQ1YKXR58FKNqbT76ua0iWUnCozl1mc7cB-PxFDhBHRHYWnT8YLfiQvkoL__MlIrX4m9s8QF9VH8fcAEOH5zyfbxTHBg4iXIK7XKtaSr6gdpyY3HYvPyfNBdO-B0xXfo5eRCbcBPBLxQTnqZ50a0AwVI3SyTl1_G-ShAOjcrbCYlW1wza_DYgsJGmLm-Z-1X6RlXTDB1tJlX74INo6ZJIBiWKlmplkpiehhz7GSBaBIrQbiwH4-bBelvFCspEnQceBGJCYd4bI_V29arQbspMWwD9zjMTewbpfgIu5Xpm-vlLvYCWHiCaN4CcX0P4sBA-MxT2fsyDVXfhxjknweUre7qsFQhmKFbwSf8FTHE-Z1QWCOIwAEJcv0148OLwiTJD8oom7Whm7bwxlNH4oKp3pTA_jWIlrx_HbR3a7Z9XJx42YC7HYaggI11q0N0HYhHyFMILnORQ51ND2FfSG4lii9DlfPEgBgOzLoFvlYcjTNigQ1pCnX_vLRJFTRLc\",\"vendor\":2},\"timezone\":\"America/Vancouver\",\"fromLanguage\":\"en\",\"learningLanguage\":\"es\",\"landingUrl\":\"https://www.duolingo.com/redeem\",\"initialReferrer\":\"https://www.reddit.com/\",\"lastReferrer\":\"https://www.reddit.com/\"}",
        "method": "POST"
    })
    
    const setCookie = userCreationResponse.headers.getSetCookie();
    
    const userId = (await userCreationResponse.json()).id;
    
    const redeemFamilyPlanResponse = await fetch(`https://www.duolingo.com/2017-06-30/users/${userId}/shop-items`, {
        "headers": {
            "Accept": "application/json; charset=UTF-8",
            "Authorization": "Bearer " + setCookie.find(cookie => cookie.startsWith("jwt_token="))!.match(/jwt_token=(.+?);/)![1],
            "Content-Type": "application/json; charset=UTF-8"
        },
        "referrer": "https://www.duolingo.com/lesson",
        "body": "{\"itemName\":\"immersive_family_subscription\",\"productId\": \"https://discord.gg/UkjYqDFMW4\",\"learningLanguage\":\"fr\",\"isFree\":true}",
        "method": "POST",
        "mode": "cors"
    });
    
    const purchaseInfo = await redeemFamilyPlanResponse.json();
    
    return purchaseInfo.familyPlanInfo.inviteToken;
}
const newDay = async () => {
    dataContent.lastRun = getCurrentDate();

    ((await client.channels.fetch("1331508473665552384")) as TextChannel).send("https://www.duolingo.com/family-plan?invite=" + await generateDuolingoInvite());

    await saveData();
}

if (dataContent.lastRun !== getCurrentDate()) newDay();

const getMillisecondsUntilMidnight = () => {
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const millisecondsUntilMidnight = midnight.getTime() - now.getTime();
    return millisecondsUntilMidnight;
}

setTimeout(() => {
    newDay();
    setInterval(newDay, 24 * 60 * 60 * 1000)
}, getMillisecondsUntilMidnight())

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "get_duolingo") return;
    await interaction.deferReply();
    let inviteCode = null;
    try {
        inviteCode = await generateDuolingoInvite();
    } catch (e) {
        return await interaction.followUp("Failed to generate an invite.")
    }
    return await interaction.followUp("https://www.duolingo.com/family-plan?invite=" + inviteCode)
})
client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isMessageContextMenuCommand()) return;
    if (interaction.commandName !== "Get Message Author") return;
    return await interaction.reply({
        content: interaction.targetMessage.author.id,
        flags: [MessageFlags.Ephemeral]
    })
})
client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "poll") return;
    const answers: PollAnswerData[] = [];
    for (let i = 1; i <= 10; i++) {
        if (!interaction.options.getString("answer_" + i + "_answer")) continue;
        answers.push({
            emoji: interaction.options.getString("answer_" + i + "_emoji") ?? undefined,
            text: interaction.options.getString("answer_" + i + "_answer")!
        })
    }
    await interaction.deferReply();
    try {
        await interaction.followUp({
            poll: {
                allowMultiselect: interaction.options.getBoolean("allow_multiple_answers")!,
                answers,
                duration: interaction.options.getInteger("duration")!,
                question: {
                    text: interaction.options.getString("question")!
                }
            }
        })
    } catch (e) {
        console.error(e);
        if (e instanceof DiscordAPIError) {
            await interaction.followUp("Error code " + e.code + ": " + e.message)
        } else {
            await interaction.followUp("An unknown error occured.")
        }
    }
})

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isAutocomplete()) return;
    if (interaction.commandName !== "poll") return;
    await interaction.respond([
        {
            name: "1 hour",
            value: 1
        },
        {
            name: "4 hours",
            value: 4
        },
        {
            name: "8 hours",
            value: 8
        },
        {
            name: "24 hours",
            value: 24
        },
        {
            name: "3 days",
            value: 24 * 3
        },
        {
            name: "1 week",
            value: 24 * 7
        },
        {
            name: "2 weeks",
            value: 24 * 14
        }
    ])
})

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isMessageContextMenuCommand()) return;
    if (interaction.commandName !== "End Bot Poll Now") return;
    if (interaction.targetMessage.author.id !== client.user?.id) return await interaction.reply({
        content: "I didn't send this message.",
        flags: MessageFlags.Ephemeral
    })
    if (interaction.targetMessage.interactionMetadata?.user.id !== interaction.user.id) return await interaction.reply({
        content: "You didn't run the command of the message.",
        flags: MessageFlags.Ephemeral
    })
    if (!interaction.targetMessage.poll) return await interaction.reply({
        content: "There is no poll.",
        flags: MessageFlags.Ephemeral
    })
    try {
        await interaction.targetMessage.poll.end();
    } catch (e) {
        console.error(e);
        if (e instanceof DiscordAPIError) {
            return await interaction.reply({
                content: "Error code " + e.code + ": " + e.message,
                flags: MessageFlags.Ephemeral
        })
        } else {
            return await interaction.reply({
                content: "An unknown error occured.",
                flags: MessageFlags.Ephemeral
            })
        }
    }
    await interaction.reply({
        content: "Poll ended."
    });
})

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "restore_quarantine_roles") return;
    const logsChannel = interaction.options.getChannel("logs_channel");
    if (!logsChannel || !(logsChannel instanceof TextChannel)) return await interaction.reply("Logs channel must be a text channel.");
    if (logsChannel.guildId !== interaction.guildId) return await interaction.reply("Wrong guild!");
    const checkMessage = async (message: Message) => {
        for (const embed of message.embeds) {
            if (embed.title !== "Roles updated") continue;
            const member = interaction.options.getMember("user")!;
            if (!(member instanceof GuildMember)) return await interaction.reply("Not a member?");
            if (embed.author?.name !== member.user.username) continue;
            const addedText = embed.description?.split("\n")[0].split("**Added:** ")[1];
            if (!addedText) continue;
            const addedId = addedText.match(/<@&([0-9]+)>/)?.[1];
            if (!addedId) continue;
            if (addedId !== interaction.options.getRole("quarantine_role")?.id) continue;
            const removedText = embed.description?.split("\n")[1].split("**Removed:** ")[1];
            if (!removedText) continue;
            let roles: string[] = [];
            for (const roleText of removedText.split(" ")) {
                const roleId = roleText.match(/<@&([0-9]+)>/)?.[1];
                if (!roleId) continue;
                roles.push(roleId);
            }
            await member.roles.add(roles);
            console.log(roles);
            console.log("Added roles.");
            return true;
        };
    }
    const messages = await logsChannel.messages.fetch({limit: 100});
    await interaction.deferReply();
    let succeeded = false;
    for (const message of messages.values()) {
        if (await checkMessage(message)) succeeded = true;
    }
    let earliest = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp)[0].id;
    while (1) {
        const earlierMessages = [...(await logsChannel.messages.fetch({limit: 100, before: earliest})).values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
        for (const message of earlierMessages) {
            if (await checkMessage(message)) succeeded = true;
        }
        if (earlierMessages.length < 100) break;
        earliest = earlierMessages[0].id;
        if (Date.now() - earlierMessages[0].createdTimestamp > 2 * 7 * 24 * 60 * 60 * 1000) break;
    }
    return await interaction.followUp(succeeded ? "Finished!" : "Message not found?")
})

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "level_gap_check") return;
    const channel = await client.channels.fetch("1275812346648072336") as TextChannel;
    let messages = [...(await channel.messages.fetch({limit: 100})).values()];
    await interaction.deferReply();
    let earliest = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp)[0].id;
    while (1) {
        const earlierMessages = [...(await channel.messages.fetch({limit: 100, before: earliest})).values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
        messages.push(...earlierMessages);
        console.log(messages.length)
        if (earlierMessages.length < 100) break;
        earliest = earlierMessages[0].id;
    }
    messages = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    let first = null;
    let previous = null;
    const result = [];
    let levelsDifference = 0;
    for (const message of messages) {
        if (!message.content.includes("<@" + interaction.options.getUser("user")!.id + ">")) continue;
        if (!message.content.match(/level \*\*([0-9]+)\*\*/)) {
            console.log(message.content);
            continue;
        }
        const level = +message.content.match(/level \*\*([0-9]+)/)![1];
        if (!first) first = level;
        if (previous && (level - previous > 1 || level <= previous)) {
            result.push(`<t:${Math.floor(message.createdTimestamp / 1000)}:F> Level ${previous} to ${level} (${level - previous > 0 ? "+" + (level - previous - 1) : level - previous - 1})`)
            levelsDifference += level - previous - 1;
        }
        previous = level;
    }
    await interaction.followUp(result.length > 0 ? `${result.join("\n")}

They have a difference of ${levelsDifference} levels.` : "No gaps found.")
})
/*
client.on(Events.MessageCreate, async message => {
    if (message.guild?.id !== "1216816878937313442") return;
    if (message.channel.id !== "1216817245259432057") return;
    if ((message.createdTimestamp - [...(await message.channel.messages.fetch({limit: 2})).values()][1].createdTimestamp) <  30 * 60 * 1000) return;
    const role = await message.guild?.roles.fetch("1403508247670947941");
    console.log(role);
    if (!role) return;
    for (const member of [...role.members.values()]) {
        if (member.id !== message.author.id) await member.roles.remove("1403508247670947941")
    }
    await message.member?.roles.add("1403508247670947941");
})
*/
client.on(Events.MessageCreate, async message => {
    if (message.content !== "!test") return;
    console.log(message.member?.toJSON())
    console.log(message.author.toJSON())
    console.log(message.author.toJSON().clan)
})

const createStyleChoice = (name: string, id: string) => styleText(name, id, false, false) + " - " + name
const styleChoices = [
    {
        name: createStyleChoice("Bold (sans-serif)", "bold-sans-serif"),
        value: "bold-sans-serif"
    },
    {
        name: createStyleChoice("Bold (serif)", "bold-serif"),
        value: "bold-serif"
    },
    {
        name: createStyleChoice("Italic (sans-serif)", "italic-sans-serif"),
        value: "italic-sans-serif"
    },
    {
        name: createStyleChoice("Italic (serif)", "italic-serif"),
        value: "italic-serif"
    },
    {
        name: createStyleChoice("Bold Italic (sans-serif)", "bold-italic-sans-serif"),
        value: "bold-italic-sans-serif"
    },
    {
        name: createStyleChoice("Bold Italic (serif)", "bold-italic-serif"),
        value: "bold-italic-serif"
    },
    {
        name: createStyleChoice("Cursive", "cursive"),
        value: "cursive"
    },
    {
        name: createStyleChoice("Cursive Bold", "cursive-bold"),
        value: "cursive-bold"
    },
    {
        name: createStyleChoice("Medieval", "medieval"),
        value: "medieval"
    },
    {
        name: createStyleChoice("Medieval Bold", "medieval-bold"),
        value: "medieval-bold"
    },
    {
        name: createStyleChoice("Doublestruck", "doublestruck"),
        value: "doublestruck"
    },
    {
        name: createStyleChoice("Typewriter", "typewriter"),
        value: "typewriter"
    },
    {
        name: createStyleChoice("Fraktur", "fraktur"),
        value: "fraktur"
    },
    {
        name: createStyleChoice("Fraktur Bold", "fraktur-bold"),
        value: "fraktur-bold"
    },
]

const commands: RESTPutAPIApplicationCommandsJSONBody = [
    ...serverIndexCommands,
    {
        type: ApplicationCommandType.ChatInput,
        name: "activity_chart",
        description: "See the activity of a member",
        options: [
            {
                type: ApplicationCommandOptionType.String,
                name: "category",
                description: "The category to check for",
                required: true,
                choices: [
                    {
                        name: "Status",
                        value: "status"
                    },
                    {
                        name: "Chat",
                        value: "chat"
                    },
                ]
            },
            {
                type: ApplicationCommandOptionType.User,
                name: "member",
                description: "The member to check for",
                required: true
            }
        ],
        integration_types: [
            ApplicationIntegrationType.GuildInstall
        ]
    },
    {
        type: ApplicationCommandType.ChatInput,
        name: "get_duolingo",
        description: "Get a Duolingo invite",
        integration_types: [
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall
        ]
    },
    {
        type: ApplicationCommandType.Message,
        name: "Get Message Author",
        integration_types: [
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall
        ],
        contexts: [
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ]
    },
    {
        type: ApplicationCommandType.ChatInput,
        name: "poll",
        description: "Create a poll in the channel",
        integration_types: [
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall
        ],
        contexts: [
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ],
        options: [
            {
                type: ApplicationCommandOptionType.String,
                name: "question",
                description: "What question do you want to ask?",
                required: true
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "answer_1_answer",
                description: "Type your answer",
                required: true
            },
            {
                type: ApplicationCommandOptionType.Integer,
                name: "duration",
                description: "Number of hours until the poll ends",
                autocomplete: true,
                required: true
            },
            {
                type: ApplicationCommandOptionType.Boolean,
                name: "allow_multiple_answers",
                description: "Allow multiple answers"
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "answer_1_emoji",
                description: "Pick an emoji"
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "answer_2_emoji",
                description: "Pick an emoji"
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "answer_2_answer",
                description: "Type your answer"
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "answer_3_emoji",
                description: "Pick an emoji"
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "answer_3_answer",
                description: "Type your answer"
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "answer_4_emoji",
                description: "Pick an emoji"
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "answer_4_answer",
                description: "Type your answer"
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "answer_5_emoji",
                description: "Pick an emoji"
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "answer_5_answer",
                description: "Type your answer"
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "answer_6_emoji",
                description: "Pick an emoji"
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "answer_6_answer",
                description: "Type your answer"
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "answer_7_emoji",
                description: "Pick an emoji"
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "answer_7_answer",
                description: "Type your answer"
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "answer_8_emoji",
                description: "Pick an emoji"
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "answer_8_answer",
                description: "Type your answer"
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "answer_9_emoji",
                description: "Pick an emoji"
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "answer_9_answer",
                description: "Type your answer"
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "answer_10_emoji",
                description: "Pick an emoji"
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "answer_10_answer",
                description: "Type your answer"
            },
        ],
    },
    {
        type: ApplicationCommandType.Message,
        name: "End Bot Poll Now",
        integration_types: [
            ApplicationIntegrationType.GuildInstall
        ]
    },
    {
        type: ApplicationCommandType.ChatInput,
        name: "style_channel_name",
        description: "Style a channel name",
        options: [
            {
                type: ApplicationCommandOptionType.String,
                name: "style",
                description: "The style to set it as",
                required: true,
                choices: styleChoices
            },
            {
                type: ApplicationCommandOptionType.Boolean,
                name: "autocapitalize",
                description: "Make each letter after after a hyphen capital?",
                required: true
            },
            {
                type: ApplicationCommandOptionType.Boolean,
                name: "preclean",
                description: "Whether or not to unstyle the text first"
            },
            {
                type: ApplicationCommandOptionType.Boolean,
                name: "prefix",
                description: "Whether or not to include a prefix"
            },
        ],
        integration_types: [
            ApplicationIntegrationType.GuildInstall
        ]
    },
    {
        type: ApplicationCommandType.ChatInput,
        name: "style_text",
        description: "Style text",
        options: [
            {
                type: ApplicationCommandOptionType.String,
                name: "text",
                description: "The text to style",
                required: true
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "style",
                description: "The style to set it as",
                required: true,
                choices: styleChoices
            },
            {
                type: ApplicationCommandOptionType.Boolean,
                name: "preclean",
                description: "Whether or not to unstyle the text first"
            },
        ],
        integration_types: [
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall
        ],
        contexts: [
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ]
    },
    {
        type: ApplicationCommandType.ChatInput,
        name: "restore_quarantine_roles",
        description: "Does not actually unquarantine them!",
        options: [
            {
                type: ApplicationCommandOptionType.User,
                name: "user",
                description: "The user to restore the roles of",
                required: true
            },
            {
                type: ApplicationCommandOptionType.Channel,
                name: "logs_channel",
                description: "The channel Carl-bot puts the logs",
                required: true
            },
            {
                type: ApplicationCommandOptionType.Role,
                name: "quarantine_role",
                description: "The role Wick uses to quarantine",
                required: true
            },
        ],
        integration_types: [
            ApplicationIntegrationType.GuildInstall
        ]
    },
    {
        type: ApplicationCommandType.ChatInput,
        name: "level_gap_check",
        description: "Checks the leveling gaps of a user",
        options: [
            {
                type: ApplicationCommandOptionType.User,
                name: "user",
                description: "The user to check the true level of",
                required: true
            }
        ],
        integration_types: [
            ApplicationIntegrationType.GuildInstall
        ]
    },
]
if (!client.application) throw new Error("No application for client?")
await client.rest.put(Routes.applicationCommands(client.application.id), {"body": commands})
