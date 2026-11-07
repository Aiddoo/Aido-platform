import type { MemoResourceLimit } from '../schemas/memo.schema';

function canCreateMemo(limit: MemoResourceLimit) {
  return limit.currentCount < limit.maxPerUser;
}

export const MemoPolicy = {
  canCreateMemo,
} as const;
