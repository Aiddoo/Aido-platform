import { TimeZone } from "#api/shared/domain/time/time-zone.vo";
import { toZonedInstant } from "#api/shared/domain/time/zoned-time";

/** 전일(KST) 가입 집계 기간 */
export interface SignupReportPeriod {
  /** 집계 시작(포함) */
  readonly start: Temporal.Instant;
  /** 집계 종료(제외) */
  readonly end: Temporal.Instant;
  /** 리포트 기준일(KST) */
  readonly reportDate: Temporal.PlainDate;
}

/** 기준 시각 기준 전일(KST 00:00 ~ 당일 KST 00:00) 집계 기간을 계산한다. */
export function computePreviousKstDayRange(now: Temporal.Instant): SignupReportPeriod {
  const midnight = Temporal.PlainTime.from("00:00");
  const timeZone = TimeZone.SEOUL;
  const kstToday = now.toZonedDateTimeISO(timeZone.value).toPlainDate();
  const reportDate = kstToday.subtract({ days: 1 });
  return {
    start: toZonedInstant({ date: reportDate, time: midnight, timeZone }),
    end: toZonedInstant({ date: kstToday, time: midnight, timeZone }),
    reportDate,
  };
}
