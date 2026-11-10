import { toIsoMonthId } from "#api/shared/domain/date/utils/format";
import { firstOfNextMonthInTimezone } from "#api/shared/domain/date/utils/timezone";

import { QUOTA_TIMEZONE } from "./quotas.constants.js";

/** 사용량을 세는 한 기간(KST 달력 월). periodKey는 QuotaUsage·QuotaCharge의 기간 열 값이다. */
export class QuotaWindow {
  readonly periodKey: string;
  readonly #resetsAtTime: number;

  constructor(periodKey: string, resetsAtTime: number) {
    this.periodKey = periodKey;
    this.#resetsAtTime = resetsAtTime;
  }

  static monthAt(at: Date): QuotaWindow {
    return new QuotaWindow(
      QuotaWindow.resolvePeriodKey(at),
      firstOfNextMonthInTimezone(at, QUOTA_TIMEZONE).getTime(),
    );
  }

  static resolvePeriodKey(at: Date): string {
    return toIsoMonthId(at, QUOTA_TIMEZONE);
  }

  /** used가 0으로 돌아가는 다음 시각 */
  get resetsAt(): Date {
    return new Date(this.#resetsAtTime);
  }

  /** 이 기간에 기록된 시각인지. 기록이 없으면(null) 이 기간 사용량은 0이다. */
  contains(recordedAt: Date | null): boolean {
    return recordedAt != null && QuotaWindow.resolvePeriodKey(recordedAt) === this.periodKey;
  }
}
