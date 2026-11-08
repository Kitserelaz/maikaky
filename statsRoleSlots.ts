import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ApplicationIntegrationType,
    Events,
    InteractionContextType,
    MessageFlags,
    PermissionFlagsBits,
} from "discord.js";
import type { Client, Guild, GuildMember, RESTPutAPIApplicationCommandsJSONBody } from "discord.js";
import { canClaimStatsRoleSlot, formatUnclaimedStatsRoleName, getNextStatsRoleSlot, getStatsRoleSlot } from "./statsRoleSlotData.ts";
import type { StatsRoleNaming, StatsRoleSlots } from "./statsRoleSlotData.ts";

export const statsRoleCommand: RESTPutAPIApplicationCommandsJSONBody[number] = {
    type: ApplicationCommandType.ChatInput,
    name: "stats-role",
    description: "Configure stats role slots and unused role names",
    default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
    integration_types: [ApplicationIntegrationType.GuildInstall],
    contexts: [InteractionContextType.Guild],
    options: [
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: "slot",
            description: "Map a slot number to its Linked Role",
            options: [
                {
                    type: ApplicationCommandOptionType.Integer,
                    name: "slot",
                    description: "The exact slot number configured on the Linked Role",
                    min_value: 1,
                    max_value: 2_147_483_647,
                    required: true,
                },
                {
                    type: ApplicationCommandOptionType.Role,
                    name: "role",
                    description: "The Linked Role assigned to this slot",
                    required: true,
                },
            ],
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: "config",
            description: "Set the name format for unclaimed and locked slots",
            options: [{
                type: ApplicationCommandOptionType.String,
                name: "name_format",
                description: "Role name template; use {status} for Unclaimed/Locked and {slot} for the number",
                min_length: 1,
                max_length: 100,
                required: true,
            }],
        },
    ],
};

export const startStatsRoleSlots = (
    client: Client,
    guildId: string,
    slots: StatsRoleSlots,
    naming: StatsRoleNaming,
    save: () => Promise<unknown>,
    syncUsers: () => Promise<void>,
    getClaimedRoleName: (userId: string) => Promise<string>,
) => {
    let updates = Promise.resolve();
    const serialize = <T>(operation: () => Promise<T>) => {
        const result = updates.then(operation);
        updates = result.then(() => {}, () => {});
        return result;
    };

    const updateUnclaimedRoleNames = async (guild: Guild) => {
        const nextSlot = getNextStatsRoleSlot(slots);
        for (const [slotId, slot] of Object.entries(slots)) {
            if (slot.ownerId) continue;
            try {
                const role = await guild.roles.fetch(slot.roleId);
                if (!role) continue;
                const locked = Number(slotId) !== nextSlot;
                const name = formatUnclaimedStatsRoleName(naming.nameFormat, slotId, locked);
                if (name !== role.name) await role.setName(name, locked ? "Stats role slot locked" : "Stats role slot available");
            } catch {
                console.error(`[Stats Roles] Could not update the name for slot ${slotId}; will retry.`);
            }
        }
    };

    const releaseSlot = async (slotId: string, ownerId: string, source: string) => {
        const slot = slots[slotId];
        if (!slot || slot.ownerId !== ownerId) return false;
        delete slot.ownerId;
        try {
            await save();
        } catch (error) {
            slot.ownerId = ownerId;
            throw error;
        }
        console.log(`[Stats Roles] Released slot ${slotId} from ${ownerId}: ${source}.`);
        return true;
    };

    const processClaim = async (member: GuildMember, slotId: string) => {
        const slot = slots[slotId];
        if (!slot || !member.roles.cache.has(slot.roleId)) return false;
        if (!canClaimStatsRoleSlot(slots, slotId, member.id)) {
            console.log(`[Stats Roles] Removing slot ${slotId} from ${member.id}: owner=${slot.ownerId ?? "unclaimed"}, assigned=${getStatsRoleSlot(slots, member.id)}.`);
            await member.roles.remove(slot.roleId, "Stats role slot belongs to another member or is not available yet");
            return true;
        }
        if (!slot.ownerId) {
            slot.ownerId = member.id;
            try {
                await save();
            } catch (error) {
                delete slot.ownerId;
                throw error;
            }
            console.log(`[Stats Roles] Claimed slot ${slotId} for ${member.id}.`);
        }
        const role = await member.guild.roles.fetch(slot.roleId);
        if (role) {
            const name = await getClaimedRoleName(member.id);
            if (role.name !== name) await role.setName(name, "Stats role streak and level updated");
        }
        return true;
    };

    const reconcile = () => serialize(async () => {
        if (Object.keys(slots).length === 0) return;
        const guild = await client.guilds.fetch(guildId);
        const members = await guild.members.fetch();
        for (const [slotId, slot] of Object.entries(slots)) {
            if (!slot.ownerId) continue;
            const owner = members.get(slot.ownerId);
            if (owner && !owner.roles.cache.has(slot.roleId)) await releaseSlot(slotId, owner.id, "role missing during reconciliation");
        }
        for (const member of members.values()) {
            for (const [slotId, slot] of Object.entries(slots)) {
                if (!member.roles.cache.has(slot.roleId)) continue;
                try {
                    await processClaim(member, slotId);
                } catch {
                    console.error(`[Stats Roles] Could not reconcile slot ${slotId} for ${member.id}; will retry.`);
                }
            }
        }
        await updateUnclaimedRoleNames(guild);
        await syncUsers();
    });

    client.on(Events.GuildMemberUpdate, (previous, member) => {
        if (member.guild.id !== guildId) return;
        const added = Object.entries(slots).filter(([, slot]) =>
            member.roles.cache.has(slot.roleId) && !previous.roles.cache.has(slot.roleId));
        const removed = Object.entries(slots).filter(([, slot]) =>
            previous.roles.cache.has(slot.roleId) && !member.roles.cache.has(slot.roleId));
        if (added.length === 0 && removed.length === 0) return;
        console.log(`[Stats Roles] Role update for ${member.id}: added=[${added.map(([id]) => id)}], removed=[${removed.map(([id]) => id)}].`);
        void serialize(async () => {
            const current = await member.guild.members.fetch({ user: member.id, force: true });
            let changed = false;
            for (const [slotId, slot] of removed) {
                if (!current.roles.cache.has(slot.roleId)) changed = await releaseSlot(slotId, current.id, "role removal event") || changed;
            }
            for (const [slotId] of added) {
                try {
                    changed = await processClaim(current, slotId) || changed;
                } catch {
                    // Ownership may already be saved even when Discord rejects a rename or removal.
                    changed = true;
                    console.error(`[Stats Roles] Could not finish claim for slot ${slotId}; will retry.`);
                }
            }
            if (changed) {
                await updateUnclaimedRoleNames(current.guild);
                await syncUsers();
            }
        }).catch(() => console.error("[Stats Roles] Could not process role claims; will retry."));
    });

    client.on(Events.InteractionCreate, async interaction => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== "stats-role") return;
        if (interaction.guildId !== guildId || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            await interaction.reply({ content: "You need Manage Server in the tracked server to configure stats role slots.", flags: MessageFlags.Ephemeral });
            return;
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        try {
            const reply = await serialize(async () => {
                const guild = await client.guilds.fetch(guildId);
                if (interaction.options.getSubcommand() === "config") {
                    const format = interaction.options.getString("name_format", true);
                    if (!format.includes("{status}")) return "Include {status} in the name format so roles can display Unclaimed or Locked. Use {slot} for the slot number.";
                    if (formatUnclaimedStatsRoleName(format, "2147483647", false).length > 100) {
                        return "The name format must produce role names of at most 100 characters, including the status and slot number.";
                    }
                    const previousFormat = naming.nameFormat;
                    naming.nameFormat = format;
                    try {
                        await save();
                    } catch (error) {
                        naming.nameFormat = previousFormat;
                        throw error;
                    }
                    await updateUnclaimedRoleNames(guild);
                    return `Unused stats role name format saved: ${format}`;
                }
                const slotId = String(interaction.options.getInteger("slot", true));
                const role = await guild.roles.fetch(interaction.options.getRole("role", true).id);
                if (!role?.tags?.guildConnections) return "Choose a Linked Role and configure its Stats role slot ID requirement first.";
                const botMember = await guild.members.fetchMe();
                const highestRole = botMember.roles.highest;
                const hasPermission = botMember.permissions.has(PermissionFlagsBits.ManageRoles);
                const isAbove = highestRole.comparePositionTo(role) > 0;
                if (!hasPermission || !isAbove) {
                    return [
                        `The main bot <@${botMember.id}> cannot manage <@&${role.id}>. It needs to rename claimed stats roles and remove competing claims.`,
                        "",
                        `**Manage Roles permission:** ${hasPermission ? "Enabled" : "Missing"}`,
                        `**Bot's highest role:** <@&${highestRole.id}> (position ${highestRole.position})`,
                        `**Selected Linked Role:** <@&${role.id}> (position ${role.position})`,
                        `**Bot's role is strictly above the selected role:** ${isAbove ? "Yes" : "No"}`,
                        `**Selected role is managed by Discord or an integration:** ${role.managed ? "Yes" : "No"}`,
                        "",
                        "**How to fix:** Open Server Settings → Roles. Enable Manage Roles on one of the main bot's roles if it is missing, then move the bot's highest role above the selected Linked Role if needed. Administrator does not bypass the role hierarchy.",
                        "Linked Roles are managed by Discord; that flag alone does not prevent the bot from renaming them.",
                        "Run /stats-role slot again after making these changes.",
                    ].join("\n");
                }
                const previous = slots[slotId];
                if (previous?.ownerId && previous.roleId !== role.id) return "A claimed slot cannot be mapped to another role.";
                if (Object.entries(slots).some(([id, slot]) => id !== slotId && slot.roleId === role.id)) {
                    return "That role is already mapped to a different slot.";
                }
                slots[slotId] = { roleId: role.id, ...(previous?.ownerId ? { ownerId: previous.ownerId } : {}) };
                try {
                    await save();
                } catch (error) {
                    if (previous) slots[slotId] = previous;
                    else delete slots[slotId];
                    throw error;
                }
                await updateUnclaimedRoleNames(guild);
                return `Stats role slot ${slotId} mapped to <@&${role.id}>. Set its Stats role slot ID requirement to exactly ${slotId}.`;
            });
            await interaction.editReply({ content: reply, allowedMentions: { parse: [] } });
            void reconcile().catch(() => console.error("[Stats Roles] Could not reconcile configured slots; will retry."));
        } catch {
            console.error("[Stats Roles] Could not save stats role slot configuration.");
            await interaction.editReply("Could not configure the stats role slot. Please try again.");
        }
    });

    const refresh = async () => {
        try {
            await reconcile();
        } catch {
            console.error("[Stats Roles] Could not reconcile slots; will retry in five minutes.");
        } finally {
            setTimeout(() => void refresh(), 5 * 60 * 1000).unref();
        }
    };
    void refresh();
};
