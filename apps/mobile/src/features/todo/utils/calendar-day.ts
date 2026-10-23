import type { TextTone } from '@src/shared/ui';
import { isDateToday, isSaturday, isSunday } from '@src/shared/utils/date';

export type CalendarDayType = 'selected' | 'today' | 'sunday' | 'saturday' | 'default';

interface CalendarDayInput {
  date: Date;
  isSelected: boolean;
  /** 렌더 중 new Date()를 만들지 않도록 useToday()의 오늘을 받는다. */
  today: Date;
}

export const getDatePickerDayStyle = ({
  date,
  isSelected,
  today,
}: CalendarDayInput): CalendarDayType => {
  if (isSelected) {
    return 'selected';
  }
  if (isDateToday(date, today)) {
    return 'today';
  }
  if (isSunday(date)) {
    return 'sunday';
  }
  if (isSaturday(date)) {
    return 'saturday';
  }
  return 'default';
};

export const getMonthViewDayStyle = ({
  date,
  isSelected,
  today,
}: CalendarDayInput): CalendarDayType => {
  if (isSelected) {
    return 'selected';
  }
  if (isSunday(date)) {
    return 'sunday';
  }
  if (isSaturday(date)) {
    return 'saturday';
  }
  if (isDateToday(date, today)) {
    return 'today';
  }
  return 'default';
};

export const isTodayHighlighted = ({ date, isSelected, today }: CalendarDayInput) => {
  return !isSelected && isDateToday(date, today);
};

export const DAY_TYPE_TONE: Record<CalendarDayType, TextTone> = {
  selected: 'white',
  today: 'brand',
  sunday: 'danger',
  saturday: 'info',
  default: 'neutral',
};
