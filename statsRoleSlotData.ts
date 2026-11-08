export type StatsRoleSlots = Record<string, { roleId: string; ownerId?: string }>;
export type StatsRoleNaming = { nameFormat: string };

export const getNextStatsRoleSlot = (slots: StatsRoleSlots) => {
    let next = 1;
    while (slots[String(next)]?.ownerId) next++;
    return next;
};

export const getStatsRoleSlot = (slots: StatsRoleSlots, userId: string) => {
    const owned = Object.entries(slots).find(([, slot]) => slot.ownerId === userId);
    if (owned) return Number(owned[0]);
    return getNextStatsRoleSlot(slots);
};

export const formatUnclaimedStatsRoleName = (format: string, slotId: string, locked: boolean) =>
    format.replaceAll("{status}", locked ? "Locked" : "Unclaimed").replaceAll("{slot}", slotId);

export const canClaimStatsRoleSlot = (slots: StatsRoleSlots, slotId: string, userId: string) => {
    const slot = slots[slotId];
    return Boolean(slot && (!slot.ownerId || slot.ownerId === userId) && getStatsRoleSlot(slots, userId) === Number(slotId));
};
