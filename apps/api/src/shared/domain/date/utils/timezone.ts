import dayjs from "dayjs";

import { DATE_FORMAT } from "../constants/date.constant.js";
import { now } from "./core.js";

const DEFAULT_TIMEZONE = "UTC";
const MINUTE_MS = 60 * 1_000;
/** 겹치는 구간은 길어야 2시간이라 이만큼 앞선 시점이면 항상 전환 전이다. */
const OVERLAP_LOOKBACK_MS = 3 * 60 * MINUTE_MS;

/**
 * 알림 배송·자격 판정 전용 폴백 타임존.
 *
 * Aido는 한국 우선 서비스라 타임존 미상(헤더 미수신) 유저는 대부분 KST다.
 * 이 상수는 날씨/야간광고 게이트 등 "발송 시각·법적 창"을 판정하는 경로에서만
 * 쓰고, 일반 날짜경계 수학(resolveTimezone→UTC)에는 절대 쓰지 않는다.
 */
export const DEFAULT_DELIVERY_TIMEZONE = "Asia/Seoul";

/** 신뢰할 수 없는 값을 런타임이 지원하는 정규 IANA 타임존으로 변환한다. */
export function normalizeIanaTimezone(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: value,
    }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

/** 잘못 저장된 레거시 값도 스케줄러를 중단시키지 않도록 UTC로 격리한다. */
export function resolveTimezone(value: unknown): string {
  return normalizeIanaTimezone(value) ?? DEFAULT_TIMEZONE;
}

/**
 * 알림 배송/자격 판정용 타임존 해석.
 *
 * `resolveTimezone`과 달리, 미상(무효/누락) 및 저장 기본값 "UTC"를
 * 한국(KST)으로 폴백한다. 이유: 앱이 매 인증요청에 실제 `X-Timezone`를 보내므로
 * 잔존 "UTC"는 사실상 "헤더를 못 받아 기본값에 머문 미상" 유저이고, 한국 우선
 * 서비스에서 이들의 발송 시각·야간광고(정보통신망법 21:00–08:00 KST) 게이트를
 * KST로 판정하는 것이 안전하다. 진짜 UTC 유저는 다음 요청의 자가치유로 교정된다.
 *
 * ⚠️ 이 함수는 알림 배송·자격·야간게이트 경로에서만 사용한다.
 * 일반 날짜경계 수학은 `resolveTimezone`(→UTC)을 유지한다.
 */
export function resolveDeliveryTimezone(value: unknown): string {
  const normalized = normalizeIanaTimezone(value);
  if (normalized == null || normalized === DEFAULT_TIMEZONE) {
    return DEFAULT_DELIVERY_TIMEZONE;
  }
  return normalized;
}

/**
 * 할 일 벽시계를 순간으로 바꿀 때 쓰는 시간대. 앞선 후보부터 쓴다(요청 → 저장값).
 * `resolveDeliveryTimezone`과 달리 저장된 UTC는 진짜 UTC 사용자일 수 있어 그대로 둔다.
 */
export function resolveWallClockTimezone(...candidates: readonly unknown[]): string {
  for (const candidate of candidates) {
    const timezone = normalizeIanaTimezone(candidate);
    if (timezone != null) {
      return timezone;
    }
  }
  return DEFAULT_DELIVERY_TIMEZONE;
}

/**
 * 지정 타임존 기준 "오늘" 날짜를 UTC midnight Date로 반환
 *
 * 사용자의 로컬 타임존에서 "오늘"이 무슨 날짜인지 확인할 때 사용합니다.
 * 반환값은 해당 날짜의 UTC 자정(00:00:00.000Z)입니다.
 *
 * @example todayInTimezone("Asia/Seoul")      // KST 기준 오늘 → UTC midnight
 * @example todayInTimezone("America/New_York") // EST 기준 오늘 → UTC midnight
 */
export function todayInTimezone(tz: string = DEFAULT_TIMEZONE): Date {
  const localDateStr = dayjs().tz(resolveTimezone(tz)).format("YYYY-MM-DD");
  return dayjs.utc(localDateStr).startOf("day").toDate();
}

/**
 * 로컬 날짜 + 시간 문자열을 UTC Date로 변환
 *
 * 사용자가 입력한 로컬 시간(날짜 + HH:mm)을 서버 저장용 UTC로 변환합니다.
 * Google Calendar 패턴: 시간 이벤트를 TIMESTAMPTZ(UTC)로 저장.
 *
 * @example parseLocalDateTime("2026-01-15", "14:00", "Asia/Seoul")      → 2026-01-15T05:00:00.000Z
 * @example parseLocalDateTime("2026-01-15", "14:00", "America/New_York") → 2026-01-15T19:00:00.000Z
 */
export function parseLocalDateTime(
  dateStr: string,
  timeStr: string,
  tz: string = DEFAULT_TIMEZONE,
): Date {
  const timezone = resolveTimezone(tz);
  const parsed = dayjs.tz(`${dateStr}T${timeStr}:00`, timezone);
  // 가을 전환으로 같은 벽시계가 두 번이면 RFC 5545대로 앞쪽(전환 전 오프셋)을 쓴다.
  // 조금 앞선 시점의 오프셋이 더 크면 그 사이에 시계가 되돌아간 것이다.
  const offsetBefore = dayjs(parsed.valueOf() - OVERLAP_LOOKBACK_MS)
    .tz(timezone)
    .utcOffset();
  if (offsetBefore > parsed.utcOffset()) {
    const earlier = dayjs(parsed.valueOf() - (offsetBefore - parsed.utcOffset()) * MINUTE_MS).tz(
      timezone,
    );
    if (earlier.format("YYYY-MM-DDTHH:mm") === `${dateStr}T${timeStr}`) {
      return earlier.utc().toDate();
    }
  }
  return parsed.utc().toDate();
}

/**
 * 지정 타임존에서 특정 시점의 날짜를 UTC midnight Date로 반환
 *
 * PostgreSQL DATE(@db.Date) 컬럼과 비교할 때 사용합니다.
 *
 * @example startOfDayInTimezone(new Date('2026-02-06T20:00:00Z'), 'Asia/Seoul')
 *   // KST 2/7 → 2026-02-07T00:00:00.000Z
 */
export function startOfDayInTimezone(date: Date = now(), tz: string = DEFAULT_TIMEZONE): Date {
  const localDateStr = dayjs(date).tz(resolveTimezone(tz)).format("YYYY-MM-DD");
  return dayjs.utc(localDateStr).startOf("day").toDate();
}

/**
 * 특정 시점이 지정 타임존에서 속한 달력 날짜 (YYYY-MM-DD)
 *
 * @example localDateInTimezone(new Date('2026-02-06T20:00:00Z'), 'Asia/Seoul') // "2026-02-07"
 */
export function localDateInTimezone(date: Date, tz: string = DEFAULT_TIMEZONE): string {
  return dayjs(date).tz(resolveTimezone(tz)).format(DATE_FORMAT.DATE_ONLY);
}

/**
 * 지정 타임존 달력에서 from의 날짜부터 to의 날짜까지의 일수. ms ÷ 하루로 세지 않아
 * DST·자정·윤일 경계에서도 사용자가 보는 달력 날짜 차이와 같다.
 *
 * @example calendarDaysBetween(new Date('2026-11-09T14:59:00Z'), new Date('2026-11-12T15:00:00Z'), 'Asia/Seoul') // 4
 */
export function calendarDaysBetween(from: Date, to: Date, tz: string = DEFAULT_TIMEZONE): number {
  return dayjs
    .utc(localDateInTimezone(to, tz))
    .diff(dayjs.utc(localDateInTimezone(from, tz)), "day");
}

/**
 * UTC Date → 지정 타임존의 로컬 시간 문자열 (HH:mm)
 *
 * 단일 할 일을 반복으로 전환할 때처럼 로컬 시간 문자열이 필요한 곳에서 사용합니다.
 * `parseLocalDateTime`의 역변환입니다.
 *
 * @example toLocalTimeString(new Date('2026-01-15T05:00:00Z'), 'Asia/Seoul') // "14:00"
 * @example toLocalTimeString(new Date('2026-01-15T14:00:00Z'), 'America/New_York') // "09:00"
 */
export function toLocalTimeString(date: Date, tz: string = DEFAULT_TIMEZONE): string {
  return dayjs(date).tz(resolveTimezone(tz)).format("HH:mm");
}

export interface DayWindowInTimezone {
  /** 로컬 달력 날짜를 UTC 자정 Date로 표현한 DATE 컬럼 비교용 값 */
  date: Date;
  /** versioned lock key에 넣는 YYYY-MM-DD 로컬 날짜 */
  localDate: string;
  /** 로컬 자정의 실제 UTC instant */
  startsAt: Date;
  /** 다음 로컬 자정의 실제 UTC instant (exclusive) */
  endsAt: Date;
}

/**
 * 한 captured instant가 속한 로컬 날짜와 실제 UTC timestamp 범위를 함께 반환한다.
 *
 * 다음 날짜의 달력 label을 먼저 만든 뒤 다시 timezone에 적용하므로 DST의 23/25시간
 * 날짜에서도 정확한 다음 로컬 자정을 구한다.
 */
export function dayWindowInTimezone(
  date: Date = now(),
  tz: string = DEFAULT_TIMEZONE,
): DayWindowInTimezone {
  const resolvedTimezone = resolveTimezone(tz);
  const localDate = dayjs(date).tz(resolvedTimezone).format("YYYY-MM-DD");
  const nextLocalDate = dayjs.utc(localDate).add(1, "day").format("YYYY-MM-DD");

  return {
    date: dayjs.utc(localDate).startOf("day").toDate(),
    localDate,
    startsAt: dayjs.tz(localDate, resolvedTimezone).utc().toDate(),
    endsAt: dayjs.tz(nextLocalDate, resolvedTimezone).utc().toDate(),
  };
}

/**
 * 지정 타임존의 월초(1일 00:00)를 실제 UTC timestamp로 반환
 *
 * `midnightInTimezone`의 월 단위 대응체. 월간 리셋/경계 비교에 사용합니다.
 *
 * @example firstOfMonthInTimezone(new Date('2026-04-18T05:00:00Z'), 'Asia/Seoul')
 *   // KST 2026-04-18 14:00 → KST 2026-04-01 00:00 → 2026-03-31T15:00:00.000Z
 * @example firstOfMonthInTimezone(new Date('2026-12-15T00:00:00Z'), 'Asia/Seoul')
 *   // KST 2026-12-15 → KST 2026-12-01 00:00 → 2026-11-30T15:00:00.000Z
 */
export function firstOfMonthInTimezone(date: Date = now(), tz: string = DEFAULT_TIMEZONE): Date {
  return dayjs(date).tz(resolveTimezone(tz)).startOf("month").utc().toDate();
}

/**
 * 지정 타임존의 다음 달 1일 00:00을 실제 UTC timestamp로 반환. 월간 사용량이 다시 0이 되는 시각이다.
 *
 * @example firstOfNextMonthInTimezone(new Date('2026-04-30T15:00:00Z'), 'Asia/Seoul')
 *   // KST 2026-05-01 00:00 → KST 2026-06-01 00:00 → 2026-05-31T15:00:00.000Z
 */
export function firstOfNextMonthInTimezone(
  date: Date = now(),
  tz: string = DEFAULT_TIMEZONE,
): Date {
  return dayjs(date).tz(resolveTimezone(tz)).startOf("month").add(1, "month").utc().toDate();
}
