import type { rewardGrant } from "#api/platform/database/schema/index";
import { instantFromDate, instantToDate } from "#api/shared/domain/time/instant";

import { RewardGrant } from "../../domain/reward-grant.entity.js";

export type RewardGrantRow = Pick<
  typeof rewardGrant.$inferSelect,
  | "id"
  | "recipientId"
  | "sourceType"
  | "sourceId"
  | "rewardType"
  | "quantity"
  | "status"
  | "attempts"
  | "createdAt"
>;

export const REWARD_GRANT_COLUMNS = {
  id: true,
  recipientId: true,
  sourceType: true,
  sourceId: true,
  rewardType: true,
  quantity: true,
  status: true,
  attempts: true,
  createdAt: true,
} as const;

export function toRewardGrant(row: RewardGrantRow): RewardGrant {
  return RewardGrant.reconstitute({ ...row, createdAt: instantFromDate(row.createdAt) });
}

export function toRewardGrantRow(grant: RewardGrant): RewardGrantRow {
  const primitives = grant.toPrimitives();
  return { ...primitives, createdAt: instantToDate(primitives.createdAt) };
}
