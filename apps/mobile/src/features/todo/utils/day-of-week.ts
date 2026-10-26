import { DAY_OF_WEEK_MAP, type DayOfWeek } from '@aido/api';
import dayjs from 'dayjs';

import { ALL_DAYS_OF_WEEK } from '../constants/day-of-week';

export const getDayOfWeekFromDate = (date: Date): DayOfWeek | undefined =>
  ALL_DAYS_OF_WEEK.find((day) => DAY_OF_WEEK_MAP[day] === date.getDay());

/** 시작일~종료일 범위 안에 선택한 요일이 하나라도 존재하는지 확인 */
export const hasSelectedDayInRange = (
  startDate: Date,
  endDate: Date,
  selectedDays: DayOfWeek[],
): boolean => {
  if (selectedDays.length === 0) {
    return false;
  }

  // 달력 일수로 센다. DST 시작일이 낀 범위는 23시간이라 ms를 하루로 나누면 마지막 날이 빠진다.
  const diffDays = dayjs(endDate).startOf('day').diff(dayjs(startDate).startOf('day'), 'day');

  if (diffDays >= 6) {
    return true;
  }

  const selectedJsDays = new Set(selectedDays.map((d) => DAY_OF_WEEK_MAP[d]));
  const startDay = startDate.getDay();
  for (let i = 0; i <= diffDays; i++) {
    if (selectedJsDays.has((startDay + i) % 7)) {
      return true;
    }
  }
  return false;
};
