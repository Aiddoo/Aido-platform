import { NIGHT_TIME_CONFIG } from "@aido/api/vocabulary";

import type { Timezone } from "#api/shared/domain/time/timezone.vo";

export interface QuietHoursWindow {
  // 이 시각부터 조용한 시간이다(포함)
  readonly start: Temporal.PlainTime;
  // 이 시각부터 다시 보낼 수 있다(제외)
  readonly end: Temporal.PlainTime;
}

// 정보통신망법 야간 광고 제한 시간(수신자 현지 21:00~08:00)
export const PUSH_QUIET_HOURS_WINDOW: QuietHoursWindow = {
  start: new Temporal.PlainTime(NIGHT_TIME_CONFIG.START_HOUR),
  end: new Temporal.PlainTime(NIGHT_TIME_CONFIG.END_HOUR),
};

export function isWithinQuietHours(params: {
  readonly instant: Temporal.Instant;
  readonly timezone: Timezone;
  readonly window: QuietHoursWindow;
}): boolean {
  const { start, end } = params.window;
  const localTime = params.instant.toZonedDateTimeISO(params.timezone.value).toPlainTime();
  const afterStart = Temporal.PlainTime.compare(localTime, start) >= 0;
  const beforeEnd = Temporal.PlainTime.compare(localTime, end) < 0;
  // 시작이 끝보다 늦으면 자정을 넘는 구간이다
  if (Temporal.PlainTime.compare(start, end) > 0) {
    return afterStart || beforeEnd;
  }
  return afterStart && beforeEnd;
}

/** 지금 뒤로 처음 조용한 시간이 시작하는 순간(받는 사람 현지 시각) */
export function nextQuietHoursStart(params: {
  readonly instant: Temporal.Instant;
  readonly timezone: Timezone;
  readonly window: QuietHoursWindow;
}): Temporal.Instant {
  const local = params.instant.toZonedDateTimeISO(params.timezone.value);
  const today = local.withPlainTime(params.window.start).toInstant();
  return Temporal.Instant.compare(today, params.instant) > 0
    ? today
    : local.add({ days: 1 }).withPlainTime(params.window.start).toInstant();
}
