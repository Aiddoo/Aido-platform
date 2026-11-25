import { timeOfDaySchema } from '@aido/api/common';
import { TODO_LIMITS, type TodoImportTimeMode } from '@aido/api/vocabulary';
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

// Hermes에 Segmenter가 없으면 코드 포인트로 나눈다
function splitGraphemes(text: string): string[] {
  if (typeof Intl.Segmenter === 'function') {
    return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)).map(
      ({ segment }) => segment,
    );
  }
  return Array.from(text);
}

// 서버 한도는 UTF-16 길이라 글자를 앞에서부터 한도 안까지만 담는다
export function truncateGraphemes(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  let truncated = '';
  for (const grapheme of splitGraphemes(text)) {
    if (maxLength < truncated.length + grapheme.length) {
      break;
    }
    truncated += grapheme;
  }
  return truncated;
}

// 비면 부른 쪽이 준 문구(앱 언어)를 쓴다
export function normalizeImportTitle(title: string | null, untitledTitle: string): string {
  const singleLine = (title ?? '')
    .replaceAll(LINE_BREAKING_CHARACTERS, ' ')
    .replaceAll(REPEATED_SPACES, ' ')
    .trim();
  const normalized = singleLine === '' ? untitledTitle : singleLine;
  return truncateGraphemes(normalized, TODO_LIMITS.TITLE_MAX_LENGTH).trim();
}

// 종일 일정의 끝은 배타적이다. 하루짜리면 null, 여러 날이면 마지막 날(포함)이다
export function getAllDayEndDate(startDate: DateKey, endDateExclusive: DateKey): DateKey | null {
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
  // 기간 안에 걸친 일정만 남긴다. 기간 전에 시작해 기간 안까지 이어지는 여러 날 일정은 서버가 기간 밖으로
  // 거절하므로 첫날을 기간 첫날로 당긴다. 당긴 첫날이 마지막 날이면 하루 일정(끝 날짜 없음)이 된다
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
