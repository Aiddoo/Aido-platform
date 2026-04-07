import { z } from 'zod';

// ─── Domain Types ───────────────────────────────────────────

export const memoItemSchema = z.object({
  id: z.number(),
  content: z.string(),
  isPinned: z.boolean(),
  sortOrder: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type MemoItem = z.infer<typeof memoItemSchema>;

export interface MemoPage {
  items: MemoItem[];
  pagination: {
    nextCursor: number | null;
    hasNext: boolean;
    size: number;
  };
}

export interface MemoResourceLimit {
  currentCount: number;
  maxPerUser: number;
}

export function canCreate(limit: MemoResourceLimit): boolean {
  return limit.currentCount < limit.maxPerUser;
}

export function remainingCount(limit: MemoResourceLimit): number {
  return limit.maxPerUser - limit.currentCount;
}

export const MemoPolicy = {
  canCreate: (limit: MemoResourceLimit): boolean => canCreate(limit),
  remainingCount: (limit: MemoResourceLimit): number => remainingCount(limit),
} as const;
