import type { inviteRedemption } from "#api/platform/database/schema/index";

import { InviteRedemption } from "../../domain/invite-redemption.aggregate.js";

export type InviteRedemptionRow = Pick<
  typeof inviteRedemption.$inferSelect,
  | "id"
  | "inviteId"
  | "inviterId"
  | "inviteeId"
  | "status"
  | "rejectionReason"
  | "timezone"
  | "inviterRewardEligible"
  | "joinedAt"
  | "qualifiedAt"
  | "rewardedAt"
  | "rejectedAt"
  | "expiresAt"
  | "qualifyReminderSentAt"
>;

export const INVITE_REDEMPTION_COLUMNS = {
  id: true,
  inviteId: true,
  inviterId: true,
  inviteeId: true,
  status: true,
  rejectionReason: true,
  timezone: true,
  inviterRewardEligible: true,
  joinedAt: true,
  qualifiedAt: true,
  rewardedAt: true,
  rejectedAt: true,
  expiresAt: true,
  qualifyReminderSentAt: true,
} as const;

export function toInviteRedemption(
  row: InviteRedemptionRow,
  activeDays: readonly Temporal.PlainDate[],
): InviteRedemption {
  return InviteRedemption.reconstitute({ ...row, activeDays });
}

export function toInviteRedemptionRow(redemption: InviteRedemption): InviteRedemptionRow {
  const { activeDays: _activeDays, ...primitives } = redemption.toPrimitives();
  return primitives;
}
