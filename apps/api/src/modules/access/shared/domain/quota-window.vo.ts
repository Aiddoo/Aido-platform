import { ValueObject } from "#api/shared/domain/model/value-object";
import { TimeZone } from "#api/shared/domain/time/time-zone.vo";

interface QuotaWindowValue {
  /** QuotaUsage·QuotaCharge의 기간 열 값(예: 2026-M04) */
  readonly periodKey: string;
  readonly startsAt: Temporal.Instant;
  /** used가 0으로 돌아가는 다음 시각 */
  readonly resetsAt: Temporal.Instant;
}

// 월간 quota 기간은 출시 앱 AI 사용량(/v1/ai/usage)과 같은 KST 달력 월이다. 사용자 시간대와 무관한 계약이다
const MONTHLY_QUOTA_TIME_ZONE = TimeZone.SEOUL;

function startOfMonth(month: Temporal.PlainYearMonth): Temporal.Instant {
  return month.toPlainDate({ day: 1 }).toZonedDateTime(MONTHLY_QUOTA_TIME_ZONE.value).toInstant();
}

/** 사용량을 세는 한 기간(KST 달력 월) */
export class QuotaWindow extends ValueObject<QuotaWindowValue> {
  static create(now: Temporal.Instant): QuotaWindow {
    const month = now
      .toZonedDateTimeISO(MONTHLY_QUOTA_TIME_ZONE.value)
      .toPlainDate()
      .toPlainYearMonth();
    return new QuotaWindow({
      periodKey: `${month.year}-M${String(month.month).padStart(2, "0")}`,
      startsAt: startOfMonth(month),
      resetsAt: startOfMonth(month.add({ months: 1 })),
    });
  }

  get periodKey(): string {
    return this.value.periodKey;
  }

  get resetsAt(): Temporal.Instant {
    return this.value.resetsAt;
  }

  /** 이 기간에 기록된 시각인지. 기록이 없으면(null) 이 기간 사용량은 0이다. */
  contains(recordedAt: Temporal.Instant | null): boolean {
    return (
      recordedAt != null &&
      Temporal.Instant.compare(recordedAt, this.value.startsAt) >= 0 &&
      Temporal.Instant.compare(recordedAt, this.value.resetsAt) < 0
    );
  }
}
