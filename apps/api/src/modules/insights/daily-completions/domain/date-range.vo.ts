import { ValueObject } from "#api/shared/domain/model/value-object";

import { invalidDateRange } from "./daily-completions.errors.js";

interface DateRangeValue {
  readonly start: Temporal.PlainDate;
  readonly end: Temporal.PlainDate;
}

/** 양 끝을 포함하는 달력 날짜 구간. 앱이 보낸 날짜 그대로이고 시간대로 다시 해석하지 않는다. */
export class DateRange extends ValueObject<DateRangeValue> {
  static create(start: Temporal.PlainDate, end: Temporal.PlainDate): DateRange {
    if (Temporal.PlainDate.compare(start, end) > 0) {
      throw invalidDateRange(start, end);
    }
    return new DateRange({ start, end });
  }

  get start(): Temporal.PlainDate {
    return this.value.start;
  }

  get end(): Temporal.PlainDate {
    return this.value.end;
  }
}
