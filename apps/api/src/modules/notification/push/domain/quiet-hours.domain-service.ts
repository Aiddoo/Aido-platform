import { NIGHT_TIME_CONFIG } from "@aido/api/vocabulary";

import type { TimeZone } from "#api/shared/domain/time/time-zone.vo";

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
  readonly timeZone: TimeZone;
  readonly window: QuietHoursWindow;
}): boolean {
  const { start, end } = params.window;
  const localTime = params.instant.toZonedDateTimeISO(params.timeZone.value).toPlainTime();
  const afterStart = Temporal.PlainTime.compare(localTime, start) >= 0;
  const beforeEnd = Temporal.PlainTime.compare(localTime, end) < 0;
  // 시작이 끝보다 늦으면 자정을 넘는 구간이다
  if (Temporal.PlainTime.compare(start, end) > 0) {
    return afterStart || beforeEnd;
  }
  return afterStart && beforeEnd;
}
