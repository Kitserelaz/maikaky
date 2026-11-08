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
import { canClaimStatsRoleSlot, formatClaimedStatsRoleName, formatUnclaimedStatsRoleName, getNextStatsRoleSlot, getStatsRoleSlot, getStatsRolePositions } from "./statsRoleSlotData.ts";
import type { StatsRoleNaming, StatsRoleSlots } from "./statsRoleSlotData.ts";
import { setupStatsRoleOverwrites } from "./statsRoleSetup.ts";

export const statsRoleCommand: RESTPutAPIApplicationCommandsJSONBody[number] = {
    type: ApplicationCommandType.ChatInput,
    name: "stats-role",
    description: "Configure stats role slots, unused names, and channel overwrites",
    default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
    integration_types: [ApplicationIntegrationType.GuildInstall],
    contexts: [InteractionContextType.Guild],
    options: [
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: "setup",
            description: "Clear channel permission overwrites for all configured stats roles",
        },
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
            description: "Set claimed, unclaimed, and locked name formats; omitted formats stay unchanged",
            options: [
                {
                    type: ApplicationCommandOptionType.String,
                    name: "claimed_format",
                    description: "Claimed name: {streak}, {current}, {longest}, {level}",
                    min_length: 1,
                    max_length: 100,
                    required: false,
                },
                {
                    type: ApplicationCommandOptionType.String,
                    name: "unclaimed_format",
                    description: "Available slot name: {status} for Unclaimed, {slot} for the number",
                    min_length: 1,
                    max_length: 100,
                    required: false,
                },
                {
                    type: ApplicationCommandOptionType.String,
                    name: "locked_format",
                    description: "Locked slot name: {status} for Locked, {slot} for the number",
                    min_length: 1,
                    max_length: 100,
                    required: false,
                },
            ],
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
    const recentClaims = new Set<string>();
    const serialize = <T>(operation: () => Promise<T>) => {
        const result = updates.then(operation);
        updates = result.then(() => {}, () => {});
        return result;
    };

    const updateRoleOrder = async (guild: Guild) => {
        if (Object.keys(slots).length < 2) {
            recentClaims.clear();
            return;
        }
        try {
            const roles = await guild.roles.fetch();
            const positions = getStatsRolePositions(slots, [...roles.values()], [...recentClaims]);
            if (positions.length > 0) await guild.roles.setPositions(positions);
            recentClaims.clear();
        } catch {
            console.error("[Stats Roles] Could not update role order; will retry.");
        }
    };

    const updateUnclaimedRoleNames = async (guild: Guild) => {
        const nextSlot = getNextStatsRoleSlot(slots);
        for (const [slotId, slot] of Object.entries(slots)) {
            if (slot.ownerId) continue;
            try {
                const role = await guild.roles.fetch(slot.roleId);
                if (!role) continue;
                const locked = Number(slotId) !== nextSlot;
                const name = formatUnclaimedStatsRoleName(locked ? naming.lockedNameFormat : naming.nameFormat, slotId, locked);
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
            recentClaims.delete(slot.roleId);
            recentClaims.add(slot.roleId);
            console.log(`[Stats Roles] Claimed slot ${slotId} for ${member.id}.`);
        }
        const role = await member.guild.roles.fetch(slot.roleId);
        if (role) {
            const name = await getClaimedRoleName(member.id);
            const colors = member.roles.highest.colors;
            const colorsChanged = role.colors.primaryColor !== colors.primaryColor ||
                role.colors.secondaryColor !== colors.secondaryColor || role.colors.tertiaryColor !== colors.tertiaryColor;
            if (role.name !== name || colorsChanged) {
                await role.edit({ name, colors, reason: "Stats role streak, level, and color updated" });
            }
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
        await updateRoleOrder(guild);
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
                await updateRoleOrder(current.guild);
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
            if (interaction.options.getSubcommand() === "config" &&
                interaction.options.getString("claimed_format") === null && interaction.options.getString("unclaimed_format") === null &&
                interaction.options.getString("locked_format") === null) {
                await interaction.editReply("No name formats supplied; nothing changed.");
                return;
            }
            if (interaction.options.getSubcommand() === "setup") {
                const roleIds = [...new Set(Object.values(slots).map(slot => slot.roleId))];
                if (roleIds.length === 0) {
                    await interaction.editReply("No stats roles are configured. Add them with /stats-role slot first.");
                    return;
                }
                const guild = await client.guilds.fetch(guildId);
                const { cleared, skipped, failed } = await setupStatsRoleOverwrites(guild, roleIds);
                await interaction.editReply(`Stats role setup finished for ${roleIds.length} roles: ${cleared} permission overwrites cleared, ${skipped} already empty, ${failed} failed.${failed ? " Check the bot's channel permissions and logs, then rerun /stats-role setup." : ""}`);
                return;
            }
            const reply = await serialize(async () => {
                const guild = await client.guilds.fetch(guildId);
                if (interaction.options.getSubcommand() === "config") {
                    const claimedFormat = interaction.options.getString("claimed_format");
                    const unclaimedFormat = interaction.options.getString("unclaimed_format");
                    const lockedFormat = interaction.options.getString("locked_format");
                    if (unclaimedFormat !== null) {
                        if (formatUnclaimedStatsRoleName(unclaimedFormat, "2147483647", false).length > 100) {
                            return "The unclaimed format must produce role names of at most 100 characters, including the status and slot number.";
                        }
                    }
                    if (lockedFormat !== null && formatUnclaimedStatsRoleName(lockedFormat, "2147483647", true).length > 100) {
                        return "The locked format must produce role names of at most 100 characters, including the status and slot number.";
                    }
                    if (claimedFormat !== null && formatClaimedStatsRoleName(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - 1, Number.MAX_SAFE_INTEGER, claimedFormat).length > 100) {
                        return "The claimed format must produce role names of at most 100 characters, including the streak and level values.";
                    }
                    const previousFormat = naming.nameFormat;
                    const previousClaimedFormat = naming.claimedNameFormat;
                    const previousLockedFormat = naming.lockedNameFormat;
                    if (unclaimedFormat !== null) naming.nameFormat = unclaimedFormat;
                    if (claimedFormat !== null) naming.claimedNameFormat = claimedFormat;
                    if (lockedFormat !== null) naming.lockedNameFormat = lockedFormat;
                    try {
                        await save();
                    } catch (error) {
                        naming.nameFormat = previousFormat;
                        naming.claimedNameFormat = previousClaimedFormat;
                        naming.lockedNameFormat = previousLockedFormat;
                        throw error;
                    }
                    if (unclaimedFormat !== null || lockedFormat !== null) await updateUnclaimedRoleNames(guild);
                    return "Stats role name formats saved. Omitted formats were left unchanged.";
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
                await updateRoleOrder(guild);
                return `Stats role slot ${slotId} mapped to <@&${role.id}>. Set its Stats role slot ID requirement to exactly ${slotId}.`;
            });
            await interaction.editReply({ content: reply, allowedMentions: { parse: [] } });
            void reconcile().catch(() => console.error("[Stats Roles] Could not reconcile configured slots; will retry."));
        } catch {
            console.error("[Stats Roles] Could not complete the stats role command.");
            await interaction.editReply("Could not complete the stats role request. Check the bot's permissions and logs.");
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
