import { z } from 'zod';

export const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

export const reorderPositionSchema = z.enum(['before', 'after']);
export type ReorderPosition = z.infer<typeof reorderPositionSchema>;
