import dayjs from "dayjs";

import { toIsoMonthId } from "#api/shared/domain/date/utils/format";

const AI_QUOTA_TIMEZONE = "Asia/Seoul";

export function getAiQuotaPeriodId(at: Date): string {
  return toIsoMonthId(at, AI_QUOTA_TIMEZONE);
}

export function isCurrentAiQuotaPeriod(resetAt: Date | null, at: Date): boolean {
  return resetAt !== null && getAiQuotaPeriodId(resetAt) === getAiQuotaPeriodId(at);
}

export function getNextAiQuotaResetAt(at: Date): Date {
  return dayjs(at).tz(AI_QUOTA_TIMEZONE).startOf("month").add(1, "month").utc().toDate();
}
