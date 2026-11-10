import { TimeZone } from "./time-zone.vo.js";

const UTC = TimeZone.UTC.value;

/** 시간대를 모르는 사용자의 발송·벽시계 기본값. 한국 우선 서비스라 미상 사용자는 대부분 서울이다. */
export const DEFAULT_DELIVERY_TIMEZONE = TimeZone.SEOUL.value;

/** 신뢰할 수 없는 값을 런타임이 지원하는 정규 IANA 이름으로 바꾼다. 쓸 수 없는 값이면 null이다. */
export function normalizeIanaTimezone(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

/** 날짜 경계 계산용. 잘못 저장된 옛 값도 작업을 멈추지 않도록 UTC로 본다. */
export function resolveTimezone(value: unknown): string {
  return normalizeIanaTimezone(value) ?? UTC;
}

/**
 * 알림 발송·자격·야간 광고 판정용. 앱이 요청마다 X-Timezone을 보내므로 저장된 UTC는 헤더를 못 받아
 * 기본값에 머문 사용자이고, 발송 시각과 법정 야간(21:00–08:00 KST)을 서울로 판정하는 편이 안전하다.
 */
export function resolveDeliveryTimezone(value: unknown): string {
  const normalized = normalizeIanaTimezone(value);
  if (normalized == null || normalized === UTC) {
    return DEFAULT_DELIVERY_TIMEZONE;
  }
  return normalized;
}

/** 할 일 벽시계를 순간으로 바꿀 시간대. 앞선 후보부터 쓰고(요청 → 저장값) 저장된 UTC는 진짜 UTC로 둔다. */
export function resolveWallClockTimezone(...candidates: readonly unknown[]): string {
  for (const candidate of candidates) {
    const timezone = normalizeIanaTimezone(candidate);
    if (timezone != null) {
      return timezone;
    }
  }
  return DEFAULT_DELIVERY_TIMEZONE;
}
