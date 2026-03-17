import { DAY_OF_WEEK_MAP, type DayOfWeek } from '@aido/validators';
import { findKey } from 'es-toolkit/compat';

export const getDayOfWeekFromDate = (date: Date): DayOfWeek | undefined =>
  findKey(DAY_OF_WEEK_MAP, (v) => v === date.getDay()) as DayOfWeek | undefined;

/** 시작일~종료일 범위 안에 선택한 요일이 하나라도 존재하는지 확인 */
export const hasSelectedDayInRange = (
  startDate: Date,
  endDate: Date,
  selectedDays: DayOfWeek[],
): boolean => {
  if (selectedDays.length === 0) return false;
  const selectedJsDays = new Set(selectedDays.map((d) => DAY_OF_WEEK_MAP[d]));
  const current = new Date(startDate);
  while (current <= endDate) {
    if (selectedJsDays.has(current.getDay())) return true;
    current.setDate(current.getDate() + 1);
  }
  return false;
};
