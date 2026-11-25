import { z } from 'zod';

const memoResourceLimitSchema = z.object({
  currentCount: z.int().nonnegative(),
  maxPerUser: z.int().positive(),
});
export type MemoResourceLimit = z.infer<typeof memoResourceLimitSchema>;

export const MemoResourceLimitPolicy = {
  canCreateMemo(limit: MemoResourceLimit): boolean {
    return limit.currentCount < limit.maxPerUser;
  },
};
