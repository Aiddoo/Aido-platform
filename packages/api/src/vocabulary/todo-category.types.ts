export const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
export const REORDER_POSITIONS = ["before", "after"] as const;
export type ReorderPosition = (typeof REORDER_POSITIONS)[number];
