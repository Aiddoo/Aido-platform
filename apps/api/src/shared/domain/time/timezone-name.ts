import { SERVICE_DEFAULT_TIMEZONE } from "@aido/api/vocabulary";

/** 날짜 경계 계산(오늘·주·하루 한도)이 시간대를 모를 때 쓰는 값 */
export const DATE_BOUNDARY_FALLBACK_TIMEZONE = "UTC";

// UTC 그 자체. 날짜 경계 대체값과 값만 같고 뜻이 다르다
const UTC_TIMEZONE = "UTC";

function toTimezoneId(value: string): string | null {
  try {
    return new Temporal.ZonedDateTime(0n, value).timeZoneId;
  } catch {
    return null;
  }
}

function isUtcOffsetId(timezoneId: string): boolean {
  return timezoneId.startsWith("+") || timezoneId.startsWith("-");
}

/**
 * 시간대 이름 해석의 기준 함수다(저장값·공급자 값. 기기 보고는 parseDeviceReportedTimezone). 런타임이 아는 IANA 이름이면
 * 대소문자만 맞춘 그 이름이고(Asia/Calcutta·US/Pacific 같은 옛 이름도 바꾸지 않는다), 고정 오프셋·빈 값·모르는 이름은
 * null이다. 기기는 IANA 이름을 보고하고, "+09:00" 같은 오프셋 문자열은 PostgreSQL `AT TIME ZONE`이 POSIX 규칙으로
 * 부호를 반대로 읽어(UTC-9) 저장값으로 쓸 수 없다. `Etc/GMT-9`는 이름이라 받는다.
 */
export function parseTimezoneName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const timezoneId = toTimezoneId(value);
  return timezoneId == null || isUtcOffsetId(timezoneId) ? null : timezoneId;
}

/** "+09:00"처럼 런타임은 받지만 parseTimezoneName이 거절하는 고정 오프셋인가 */
export function isUtcOffsetTimezone(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }
  const timezoneId = toTimezoneId(value);
  return timezoneId != null && isUtcOffsetId(timezoneId);
}

/**
 * 이름이 달라도(Asia/Calcutta·Asia/Kolkata) 같은 시간대인가. 오프셋만 같은 다른 지역(서울·도쿄)은 다르다.
 * 둘 중 하나라도 유효하지 않으면 false다.
 */
export function isSameTimezone(left: unknown, right: unknown): boolean {
  const leftTimezone = parseTimezoneName(left);
  const rightTimezone = parseTimezoneName(right);
  return (
    leftTimezone != null &&
    rightTimezone != null &&
    new Temporal.ZonedDateTime(0n, leftTimezone).equals(
      new Temporal.ZonedDateTime(0n, rightTimezone),
    )
  );
}

/** UTC·Etc/UTC·GMT처럼 이름은 달라도 UTC와 같은 유효한 시간대인가. 오프셋이 0인 지역 이름(Europe/London)은 아니다 */
function isUtcEquivalentTimezone(value: unknown): boolean {
  return isSameTimezone(value, UTC_TIMEZONE);
}

/**
 * 기기가 보고한 시간대(X-Timezone·푸시 기기 보고·토큰 등록·설정 변경)를 해석하는 입구 함수다. UTC와 같은 이름은
 * 보고하지 않은 것(null)으로 읽는다. 출시된 앱은 기기 시간대를 못 읽으면 'UTC'를 보낸다.
 */
export function parseDeviceReportedTimezone(value: unknown): string | null {
  const timezone = parseTimezoneName(value);
  return timezone == null || isUtcEquivalentTimezone(timezone) ? null : timezone;
}

/** 날짜 경계 계산용(오늘·주·하루 한도·표시 날짜). 잘못 저장된 값도 작업을 멈추지 않도록 UTC로 본다. */
export function resolveDateBoundaryTimezone(value: unknown): string {
  return parseTimezoneName(value) ?? DATE_BOUNDARY_FALLBACK_TIMEZONE;
}

/** 저장된 시간대(잘못되면 UTC)에서 그 순간이 속한 달력 날짜 */
export function localDateIn(instant: Temporal.Instant, timezone: unknown): Temporal.PlainDate {
  return instant.toZonedDateTimeISO(resolveDateBoundaryTimezone(timezone)).toPlainDate();
}

/**
 * 발송 시각 판단용(리마인더 시각·법정 야간·발송 하루·AI 제안과 리포트의 발송 창). 저장된 UTC는 기기 보고를 받지 못해
 * 가입 기본값에 머문 사용자이고, 발송 시각과 법정 야간(21:00–08:00 KST)을 서비스 기본 시간대로 판정하는 편이 안전하다.
 */
export function resolveDeliveryTimezone(value: unknown): string {
  const timezone = parseTimezoneName(value);
  if (timezone == null || isUtcEquivalentTimezone(timezone)) {
    return SERVICE_DEFAULT_TIMEZONE;
  }
  return timezone;
}

/** 할 일 벽시계를 순간으로 바꿀 시간대. 앞선 후보부터 쓰고(요청 → 저장값) 저장된 UTC는 진짜 UTC로 둔다. */
export function resolveWallClockTimezone(...candidates: readonly unknown[]): string {
  for (const candidate of candidates) {
    const timezone = parseTimezoneName(candidate);
    if (timezone != null) {
      return timezone;
    }
  }
  return SERVICE_DEFAULT_TIMEZONE;
}
