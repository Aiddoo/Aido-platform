import dayjs from "dayjs";

export interface IsoWeekRange {
  /** 이전 주 월요일 00:00:00.000Z */
  start: Date;
  /** 이번 주 월요일 00:00:00.000Z (exclusive upper bound) */
  end: Date;
  /** 이전 주의 ISO year */
  isoYear: number;
  /** 이전 주의 ISO week number */
  isoWeek: number;
}

/**
 * 이전 ISO 주차의 월~일 범위를 반환
 *
 * @param today - UTC midnight Date
 * @returns 이전 주의 날짜 범위와 ISO 식별자
 *
 * @example
 * previousIsoWeekRange(new Date("2024-01-15T00:00:00.000Z"))
 * // { start: 2024-01-08, end: 2024-01-15, isoYear: 2024, isoWeek: 2 }
 */
export function previousIsoWeekRange(today: Date): IsoWeekRange {
  const thisMonday = dayjs.utc(today).startOf("isoWeek");
  const prevMonday = thisMonday.subtract(1, "week");
  return {
    start: prevMonday.toDate(),
    end: thisMonday.toDate(),
    isoYear: prevMonday.isoWeekYear(),
    isoWeek: prevMonday.isoWeek(),
  };
}
