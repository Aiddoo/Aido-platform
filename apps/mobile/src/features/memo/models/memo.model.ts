import { MEMO_LIMITS } from '@aido/validators';
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

// ─── Policy ─────────────────────────────────────────────────

export const MemoPolicy = {
  canCreate: (currentCount: number, maxPerUser: number): boolean => currentCount < maxPerUser,

  isContentValid: (content: string): boolean =>
    content.trim().length >= 1 && content.length <= MEMO_LIMITS.MAX_CONTENT_LENGTH,
} as const;
