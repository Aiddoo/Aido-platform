import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { ValueObject } from "#api/shared/domain/model/value-object";

interface DateRangeValue {
  readonly start: Temporal.PlainDate;
  readonly end: Temporal.PlainDate;
}

/** 양 끝을 포함하는 달력 날짜 구간. 앱이 보낸 날짜 그대로이고 시간대로 다시 해석하지 않는다. */
export class DateRange extends ValueObject<DateRangeValue> {
  static create(start: Temporal.PlainDate, end: Temporal.PlainDate): DateRange {
    if (Temporal.PlainDate.compare(start, end) > 0) {
      throw new DomainException(ErrorCode.SYS_0002, {
        field: "dateRange",
        startDate: start.toString(),
        endDate: end.toString(),
      });
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
