import { ValueObject } from "#api/shared/domain/model/value-object";

import { invalidIsoWeek } from "./weekly-achievements.errors.js";

const FIRST_WEEK = 1;
// 응답의 주 날짜가 네 자리 연도(YYYY-MM-DD)라 그 밖의 해는 주를 만들지 않는다
const FIRST_YEAR = 1;
const LAST_YEAR = 9999;
// ISO 달력 날짜는 주 번호가 늘 있어 쓰이지 않는다. 타입만 undefined를 허용한다
const MAX_ISO_WEEK = 53;

interface IsoWeekValue {
  readonly year: number;
  readonly week: number;
}

function weeksInIsoYear(year: number): number {
  // 12월 28일은 언제나 그해 마지막 ISO 주에 있다
  return Temporal.PlainDate.from({ year, month: 12, day: 28 }).weekOfYear ?? MAX_ISO_WEEK;
}

/**
 * ISO 8601 주(월요일 시작). `create`는 그해에 있는 주만 받는다(52주인 해의 53주는 없다).
 * 저장값 복원은 검사하지 않고, 52주인 해의 53주는 다음 해 1주와 같은 날짜를 가리킨다(출시 응답과 같다)
 */
export class IsoWeek extends ValueObject<IsoWeekValue> {
  static create(year: number, week: number): IsoWeek {
    if (!IsoWeek.exists(year, week)) {
      throw invalidIsoWeek(year, week);
    }
    return new IsoWeek({ year, week });
  }

  static reconstitute(year: number, week: number): IsoWeek {
    return new IsoWeek({ year, week });
  }

  /** 그 ISO 연도에 있는 주인지. 주 수는 해마다 52 또는 53이다 */
  static exists(year: number, week: number): boolean {
    const isSupportedYear = Number.isSafeInteger(year) && FIRST_YEAR <= year && year <= LAST_YEAR;
    return (
      isSupportedYear &&
      Number.isSafeInteger(week) &&
      FIRST_WEEK <= week &&
      week <= weeksInIsoYear(year)
    );
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
      next.year === this.year + 1 &&
      next.week === FIRST_WEEK &&
      this.week === weeksInIsoYear(this.year)
    );
  }
}
