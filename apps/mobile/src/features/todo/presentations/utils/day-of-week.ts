import { DAY_OF_WEEK_MAP, type DayOfWeek } from '@aido/validators';
import { findKey } from 'es-toolkit/compat';

export const getDayOfWeekFromDate = (date: Date): DayOfWeek | undefined =>
  findKey(DAY_OF_WEEK_MAP, (v) => v === date.getDay()) as DayOfWeek | undefined;
