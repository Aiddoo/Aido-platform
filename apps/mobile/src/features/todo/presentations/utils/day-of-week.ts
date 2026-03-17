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

  const diffDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays >= 6) return true;

  const selectedJsDays = new Set(selectedDays.map((d) => DAY_OF_WEEK_MAP[d]));
  const startDay = startDate.getDay();
  for (let i = 0; i <= diffDays; i++) {
    if (selectedJsDays.has((startDay + i) % 7)) return true;
  }
  return false;
};
