import type { DateKey } from '@src/shared/date/date-key';

import {
  IMPORT_RANGE_PRESET_NAMES,
  IMPORT_RANGE_PRESETS,
  type ImportRangePreset,
} from '../constants/todo-import.constants';
import type { ImportCollection } from '../domains/todo-import-collection.model';
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;

/** Android는 계정 이름이 이메일이라 같은 서비스의 계정 여러 개를 가려 보인다 */
export function findAccountEmail(collection: Pick<ImportCollection, 'accountName'>): string | null {
  const name = collection.accountName?.trim() ?? '';
  return EMAIL_PATTERN.test(name) ? name : null;
}
