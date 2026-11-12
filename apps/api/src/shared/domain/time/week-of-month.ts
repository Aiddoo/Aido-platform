import type { SupportedLocale } from "#api/shared/domain/locale";

const DAYS_PER_WEEK = 7;
const MONDAY_TO_THURSDAY_DAYS = 3;

const MONTH_SHORT_EN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

interface WeekLabelParts {
  readonly month: number;
  readonly weekOfMonth: number;
  /** 주차 달의 해가 올해가 아닐 때만 있다 */
  readonly year: number | null;
}

const WEEK_LABELS: Record<SupportedLocale, (parts: WeekLabelParts) => string> = {
  ko: ({ month, weekOfMonth, year }) =>
    year == null ? `${month}월 ${weekOfMonth}주차` : `${year}년 ${month}월 ${weekOfMonth}주차`,
  en: ({ month, weekOfMonth, year }) =>
    year == null
      ? `Week ${weekOfMonth} of ${MONTH_SHORT_EN[month - 1]}`
      : `Week ${weekOfMonth} of ${MONTH_SHORT_EN[month - 1]} ${year}`,
};

export interface WeekOfMonth {
  /** 주의 가운데 날(ISO 주는 목요일). 주차의 연·월은 이 날의 것이다 */
  readonly middleDate: Temporal.PlainDate;
  /** 가운데 날이 그 달의 몇째 목요일인지(1~5) */
  readonly weekOfMonth: number;
}

/** 앱 getIsoWeekOfMonth와 같은 규칙이고 같은 표(packages/api/test/fixtures/week-of-month-cases.json)로 테스트한다 */
export function getIsoWeekOfMonth(date: Temporal.PlainDate): WeekOfMonth {
  const middleDate = date
    .subtract({ days: date.dayOfWeek - 1 })
    .add({ days: MONDAY_TO_THURSDAY_DAYS });
  return { middleDate, weekOfMonth: Math.ceil(middleDate.day / DAYS_PER_WEEK) };
}

/**
 * 주간 성취와 주간 리포트가 같은 라벨을 쓴다(ko "11월 2주차", en "Week 2 of Nov"). 앱 formatIsoWeekLabel과 같은 글자다.
 * 주차 달의 해가 사용자 시간대의 올해가 아니면 연도를 붙여 해가 다른 같은 주차와 구별한다("2025년 12월 1주차")
 */
export function formatIsoWeekLabel(
  date: Temporal.PlainDate,
  locale: SupportedLocale,
  localToday: Temporal.PlainDate,
): string {
  const { middleDate, weekOfMonth } = getIsoWeekOfMonth(date);
  const isThisYear = middleDate.year === localToday.year;
  return WEEK_LABELS[locale]({
    month: middleDate.month,
    weekOfMonth,
    year: isThisYear ? null : middleDate.year,
  });
}
