import type { TextTone } from '@src/shared/ui/Text/Text.types';
import { isDateToday, isSaturday, isSunday } from '@src/shared/utils/date';

export type CalendarDayType = 'selected' | 'today' | 'sunday' | 'saturday' | 'default';

interface CalendarDayInput {
  date: Date;
  isSelected: boolean;
}

export const getDatePickerDayStyle = ({ date, isSelected }: CalendarDayInput): CalendarDayType => {
  if (isSelected) return 'selected';
  if (isDateToday(date)) return 'today';
  if (isSunday(date)) return 'sunday';
  if (isSaturday(date)) return 'saturday';
  return 'default';
};

export const getMonthViewDayStyle = ({ date, isSelected }: CalendarDayInput): CalendarDayType => {
  if (isSelected) return 'selected';
  if (isSunday(date)) return 'sunday';
  if (isSaturday(date)) return 'saturday';
  if (isDateToday(date)) return 'today';
  return 'default';
};

export const isTodayHighlighted = ({ date, isSelected }: CalendarDayInput) => {
  return !isSelected && isDateToday(date);
};

export const DAY_TYPE_TONE: Record<CalendarDayType, TextTone> = {
  selected: 'white',
  today: 'brand',
  sunday: 'danger',
  saturday: 'info',
  default: 'neutral',
};
