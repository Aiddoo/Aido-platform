import { addDaysToDateKey, type DateKey, dateKeySchema } from '@src/shared/date/date-key';
import { z } from 'zod';

const todoImportRangeSchema = z.object({
  startDate: dateKeySchema,
  endDate: dateKeySchema,
});
export type TodoImportRange = z.infer<typeof todoImportRangeSchema>;

const todoImportRangePresetSchema = z.enum(['week', 'month', 'quarter', 'half', 'year']);
export type TodoImportRangePreset = z.infer<typeof todoImportRangePresetSchema>;

// 빠른 선택이 고르는 기간(첫날 포함 일 수). "1개월"은 30일이라 31일짜리 달에도 무료 기간(30일)을 넘지 않는다
const RANGE_PRESET_DAYS = {
  week: 7,
  month: 30,
  quarter: 90,
  half: 180,
  year: 365,
} as const satisfies Record<TodoImportRangePreset, number>;

const DEFAULT_RANGE_PRESET: TodoImportRangePreset = 'month';

// 첫날을 포함해 days일째 되는 날
export function calculateRangeEndDate(startDate: DateKey, days: number): DateKey {
  return addDaysToDateKey(startDate, days - 1);
}

// horizonDays는 서버 CALENDAR_IMPORT 한도이고 null은 기간 제한이 없다
export function findLastAllowedDate(todayKey: DateKey, horizonDays: number | null): DateKey | null {
  return horizonDays == null ? null : calculateRangeEndDate(todayKey, horizonDays);
}

export function isDateWithinHorizon(
  date: DateKey,
  todayKey: DateKey,
  horizonDays: number | null,
): boolean {
  const lastAllowedDate = findLastAllowedDate(todayKey, horizonDays);
  return todayKey <= date && (lastAllowedDate == null || date <= lastAllowedDate);
}

export function createDefaultTodoImportRange(todayKey: DateKey): TodoImportRange {
  return {
    startDate: todayKey,
    endDate: calculateRangeEndDate(todayKey, RANGE_PRESET_DAYS[DEFAULT_RANGE_PRESET]),
  };
}

export const TodoImportRangePolicy = {
  // 직접 고른 끝 날은 null이다
  findPreset(range: TodoImportRange): TodoImportRangePreset | null {
    return (
      todoImportRangePresetSchema.options.find(
        (preset) => this.withPreset(range, preset).endDate === range.endDate,
      ) ?? null
    );
  },

  // 끝 날이 새 첫날보다 앞서면 첫날로 당긴다
  withStartDate(range: TodoImportRange, startDate: DateKey): TodoImportRange {
    return { startDate, endDate: range.endDate < startDate ? startDate : range.endDate };
  },

  withEndDate(range: TodoImportRange, endDate: DateKey): TodoImportRange {
    return { startDate: range.startDate, endDate };
  },

  withPreset(range: TodoImportRange, preset: TodoImportRangePreset): TodoImportRange {
    return this.withEndDate(
      range,
      calculateRangeEndDate(range.startDate, RANGE_PRESET_DAYS[preset]),
    );
  },

  // 요금제 기간을 넘는 빠른 선택은 고르지 못한다
  canUsePreset(
    range: TodoImportRange,
    preset: TodoImportRangePreset,
    todayKey: DateKey,
    horizonDays: number | null,
  ): boolean {
    return isDateWithinHorizon(this.withPreset(range, preset).endDate, todayKey, horizonDays);
  },
};
