import { timeOfDaySchema } from '@aido/api/common';
import type { TodoImportTimeMode } from '@aido/api/vocabulary';
import { createTodoTitle } from '@src/features/planning/todo/domains/todo.model';
import { addDaysToDateKey, type DateKey, dateKeySchema } from '@src/shared/date/date-key';
import type { Instant } from '@src/shared/date/instant';
import { toDateKey, toHHmm } from '@src/shared/date/zoned';
import { countBy } from 'es-toolkit';
import { z } from 'zod';

import type { TodoImportRange } from './todo-import-range.model';

// 회차 키와 제목 없이 일정 수만 셀 때 쓰는 날짜
const todoImportItemPreviewSchema = z.object({
  collectionKey: z.string(),
  startDate: dateKeySchema,
  endDate: dateKeySchema.nullable(),
  localTime: timeOfDaySchema.nullable(),
});
export type TodoImportItemPreview = z.infer<typeof todoImportItemPreviewSchema>;

// 기기 밖으로는 제목·날짜·시각과 해시 키만 나간다
export const todoImportItemSchema = todoImportItemPreviewSchema.extend({
  sourceKey: z.string(),
  title: z.string(),
});
export type TodoImportItem = z.infer<typeof todoImportItemSchema>;

const LINE_BREAKING_CHARACTERS = /[\p{Cc}\p{Zl}\p{Zp}]+/gu;
const REPEATED_SPACES = /\s{2,}/gu;

// 비면 부른 쪽이 준 문구(앱 언어)를 쓴다
export function normalizeImportTitle(title: string | null, untitledTitle: string): string {
  const singleLine = (title ?? '')
    .replaceAll(LINE_BREAKING_CHARACTERS, ' ')
    .replaceAll(REPEATED_SPACES, ' ')
    .trim();
  const normalized = singleLine === '' ? untitledTitle : singleLine;
  return createTodoTitle(normalized).trim();
}

// 종일 일정의 끝은 배타적이다. 하루짜리면 null, 여러 날이면 마지막 날(포함)이다
export function findAllDayEndDate(startDate: DateKey, endDateExclusive: DateKey): DateKey | null {
  const lastDate = addDaysToDateKey(endDateExclusive, -1);
  return startDate < lastDate ? lastDate : null;
}

// 날짜만 가져오면 시각을 버려 알림이 없다
export function getTimedDates(
  startsAt: Instant,
  { timezone, timeMode }: { timezone: string; timeMode: TodoImportTimeMode },
): { startDate: DateKey; localTime: string | null } {
  return {
    startDate: toDateKey(startsAt, timezone),
    localTime: timeMode === 'TIME' ? toHHmm(startsAt, timezone) : null,
  };
}

export const TodoImportItemPolicy = {
  // 기간 전에 시작해 기간 안까지 이어지는 여러 날 일정은 서버가 기간 밖으로 거절하므로 첫날을 기간 첫날로 당긴다
  filterByRange<TItem extends TodoImportItemPreview>(
    items: readonly TItem[],
    { startDate, endDate }: TodoImportRange,
  ): TItem[] {
    return items.flatMap((item) => {
      const lastDate = item.endDate ?? item.startDate;
      if (endDate < item.startDate || lastDate < startDate) {
        return [];
      }
      if (startDate <= item.startDate) {
        return [item];
      }
      return [{ ...item, startDate, endDate: startDate < lastDate ? lastDate : null }];
    });
  },

  // 일정이 없는 캘린더는 키가 없다
  calculateCountByCollection(items: readonly TodoImportItemPreview[]): Record<string, number> {
    return countBy(items, (item) => item.collectionKey);
  },
};
