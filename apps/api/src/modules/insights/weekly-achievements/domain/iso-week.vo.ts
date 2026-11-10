import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { ValueObject } from "#api/shared/domain/model/value-object";

const MAX_ISO_WEEK = 53;

interface IsoWeekValue {
  readonly year: number;
  readonly week: number;
}

function weeksInIsoYear(year: number): number {
  // 12월 28일은 언제나 그해 마지막 ISO 주에 있다
  return new Temporal.PlainDate(year, 12, 28).weekOfYear ?? MAX_ISO_WEEK;
}

/** ISO 8601 주(월요일 시작). 52주인 해의 53주는 다음 해 1주와 같은 날짜를 가리킨다(출시 응답과 같다) */
export class IsoWeek extends ValueObject<IsoWeekValue> {
  static create(year: number, week: number): IsoWeek {
    if (!Number.isSafeInteger(week) || week < 1 || week > MAX_ISO_WEEK) {
      throw new DomainException(ErrorCode.SYS_0002, { field: "week", value: week });
    }
    return new IsoWeek({ year, week });
  }

  static reconstitute(year: number, week: number): IsoWeek {
    return new IsoWeek({ year, week });
  }

  get year(): number {
    return this.value.year;
  }

  get week(): number {
    return this.value.week;
  }

  get startDate(): Temporal.PlainDate {
    // 1월 4일은 언제나 1주에 있다
    const january4 = new Temporal.PlainDate(this.value.year, 1, 4);
    return january4.subtract({ days: january4.dayOfWeek - 1 }).add({ weeks: this.value.week - 1 });
  }

  get endDate(): Temporal.PlainDate {
    return this.startDate.add({ days: 6 });
  }

  /** next가 바로 다음 주인지(연말 52·53주 → 다음 해 1주 포함) */
  isFollowedBy(next: IsoWeek): boolean {
    if (next.year === this.year) {
      return next.week === this.week + 1;
    }
    return (
      next.year === this.year + 1 && next.week === 1 && this.week === weeksInIsoYear(this.year)
    );
  }
}
