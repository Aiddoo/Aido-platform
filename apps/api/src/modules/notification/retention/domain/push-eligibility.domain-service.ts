import { resolveDeliveryTimezone } from "#api/shared/domain/time/time-zone-name";

export interface RetentionPushEligibilityInput {
  readonly pushEnabled: boolean;
  readonly marketingPushAgreedAt: Temporal.Instant | null;
  readonly activeTokenCount: number;
  readonly timezone: string;
  readonly now: Temporal.Instant;
}

export function retentionPushSkipReason(input: RetentionPushEligibilityInput): string | null {
  if (!input.pushEnabled) {
    return "PUSH_DISABLED";
  }
  if (!input.marketingPushAgreedAt) {
    return "MARKETING_CONSENT_REQUIRED";
  }
  if (input.activeTokenCount === 0) {
    return "NO_ACTIVE_TOKEN";
  }
  const hour = localHour(input.now, input.timezone);
  if (hour < 8 || hour >= 21) {
    return "MARKETING_QUIET_HOURS";
  }
  return null;
}

function localHour(instant: Temporal.Instant, timezone: string): number {
  // 마케팅 quiet-hours는 지역 기준 — 미상(UTC) 유저는 KST로 폴백해 판정
  return instant.toZonedDateTimeISO(resolveDeliveryTimezone(timezone)).hour;
}
