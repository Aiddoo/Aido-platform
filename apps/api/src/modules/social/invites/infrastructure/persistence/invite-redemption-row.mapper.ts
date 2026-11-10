import type { inviteRedemption } from "#api/platform/database/schema/index";
import { instantFromDate, instantToDate } from "#api/shared/domain/time/instant";

import { InviteRedemption } from "../../domain/invite-redemption.aggregate.js";

const UTC = "UTC";

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

function instantOrNull(date: Date | null): Temporal.Instant | null {
  return date == null ? null : instantFromDate(date);
}

function dateOrNull(instant: Temporal.Instant | null): Date | null {
  return instant == null ? null : instantToDate(instant);
}

// DATE 칸은 그 날짜의 UTC 자정 Date로 오간다. 시간대를 끼우면 날짜가 하루 밀린다
function plainDateFromDateColumn(date: Date): Temporal.PlainDate {
  return instantFromDate(date).toZonedDateTimeISO(UTC).toPlainDate();
}

export function plainDateToDateColumn(date: Temporal.PlainDate): Date {
  return instantToDate(date.toZonedDateTime(UTC).toInstant());
}

export function toInviteRedemption(
  row: InviteRedemptionRow,
  activeDays: readonly Date[],
): InviteRedemption {
  return InviteRedemption.reconstitute({
    ...row,
    activeDays: activeDays.map(plainDateFromDateColumn),
    joinedAt: instantFromDate(row.joinedAt),
    qualifiedAt: instantOrNull(row.qualifiedAt),
    rewardedAt: instantOrNull(row.rewardedAt),
    rejectedAt: instantOrNull(row.rejectedAt),
    expiresAt: instantFromDate(row.expiresAt),
    qualifyReminderSentAt: instantOrNull(row.qualifyReminderSentAt),
  });
}

export function toInviteRedemptionRow(redemption: InviteRedemption): InviteRedemptionRow {
  const { activeDays: _activeDays, ...primitives } = redemption.toPrimitives();
  return {
    ...primitives,
    joinedAt: instantToDate(primitives.joinedAt),
    qualifiedAt: dateOrNull(primitives.qualifiedAt),
    rewardedAt: dateOrNull(primitives.rewardedAt),
    rejectedAt: dateOrNull(primitives.rejectedAt),
    expiresAt: instantToDate(primitives.expiresAt),
    qualifyReminderSentAt: dateOrNull(primitives.qualifyReminderSentAt),
  };
}
