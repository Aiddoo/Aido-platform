import type { DateKey } from '@src/shared/date/date-key';

import {
  IMPORT_RANGE_PRESET_NAMES,
  IMPORT_RANGE_PRESETS,
  type ImportRangePreset,
} from '../constants/todo-import.constants';
import { getRangeEndDate } from '../domains/todo-import.model';

export const IMPORT_RANGE_PRESET_LABEL_KEYS = {
  week: 'range.presets.week',
  month: 'range.presets.month',
  quarter: 'range.presets.quarter',
  half: 'range.presets.half',
  year: 'range.presets.year',
} as const satisfies Record<ImportRangePreset, string>;

/** 직접 고른 끝 날은 null이다 */
export function findRangePreset({
  startDate,
  endDate,
}: {
  startDate: DateKey;
  endDate: DateKey;
}): ImportRangePreset | null {
  return (
    IMPORT_RANGE_PRESET_NAMES.find(
      (preset) => getRangeEndDate(startDate, IMPORT_RANGE_PRESETS[preset]) === endDate,
    ) ?? null
  );
}
