import { OPERATOR_TIMEZONE } from "#api/shared/domain/time/operator-timezone";
import { Timezone } from "#api/shared/domain/time/timezone.vo";
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
  const timezone = Timezone.reconstitute(OPERATOR_TIMEZONE);
  const kstToday = now.toZonedDateTimeISO(timezone.value).toPlainDate();
  const reportDate = kstToday.subtract({ days: 1 });
  return {
    start: toZonedInstant({ date: reportDate, time: midnight, timezone }),
    end: toZonedInstant({ date: kstToday, time: midnight, timezone }),
    reportDate,
  };
}
