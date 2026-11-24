import { timeOfDaySchema } from '@aido/api/common';
import { TODO_IMPORT_LIMITS, TODO_LIMITS, type TodoImportTimeMode } from '@aido/api/vocabulary';
import { addDaysToDateKey, type DateKey, dateKeySchema } from '@src/shared/date/date-key';
import type { Instant } from '@src/shared/date/instant';
import { toDateKey, toHHmm } from '@src/shared/date/zoned';
import { chunk, countBy, orderBy, uniqBy } from 'es-toolkit';
import { z } from 'zod';

/** 기기 밖으로는 제목·날짜·시각과 해시 키만 나간다 */
export const importItemSchema = z.object({
  sourceKey: z.string(),
  collectionKey: z.string(),
  title: z.string(),
  startDate: dateKeySchema,
  endDate: dateKeySchema.nullable(),
  localTime: timeOfDaySchema.nullable(),
});
export type ImportItem = z.infer<typeof importItemSchema>;

const LINE_BREAKING_CHARACTERS = /[\p{Cc}\p{Zl}\p{Zp}]+/gu;
const REPEATED_SPACES = /\s{2,}/gu;

/** Hermes에 Segmenter가 없으면 코드 포인트로 나눈다 */
function splitGraphemes(text: string): string[] {
  if (typeof Intl.Segmenter === 'function') {
    return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)).map(
      ({ segment }) => segment,
    );
  }
  return Array.from(text);
}

/** 서버 한도는 UTF-16 길이라 글자를 앞에서부터 한도 안까지만 담는다 */
function truncateGraphemes(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  let truncated = '';
  for (const grapheme of splitGraphemes(text)) {
    if (truncated.length + grapheme.length > maxLength) {
      break;
    }
    truncated += grapheme;
  }
  return truncated;
}

/** 비면 부른 쪽이 준 문구(앱 언어)를 쓴다 */
export function normalizeImportTitle(title: string | null, untitledTitle: string): string {
  const singleLine = (title ?? '')
    .replaceAll(LINE_BREAKING_CHARACTERS, ' ')
    .replaceAll(REPEATED_SPACES, ' ')
    .trim();
  const normalized = singleLine === '' ? untitledTitle : singleLine;
  return truncateGraphemes(normalized, TODO_LIMITS.TITLE_MAX_LENGTH).trim();
}

/** 종일 일정의 끝은 배타적이다. 하루짜리면 null, 여러 날이면 마지막 날(포함)이다 */
export function getAllDayEndDate(startDate: DateKey, endDateExclusive: DateKey): DateKey | null {
  const lastDate = addDaysToDateKey(endDateExclusive, -1);
  return lastDate > startDate ? lastDate : null;
}

/** 날짜만 가져오면 시각을 버려 알림이 없다 */
export function getTimedDates(
  startsAt: Instant,
  { timezone, timeMode }: { timezone: string; timeMode: TodoImportTimeMode },
): { startDate: DateKey; localTime: string | null } {
  return {
    startDate: toDateKey(startsAt, timezone),
    localTime: timeMode === 'TIME' ? toHHmm(startsAt, timezone) : null,
  };
}

/** 기간 전에 시작한 여러 날 일정은 서버가 기간 밖으로 거절한다 */
export function filterByRange(
  items: readonly ImportItem[],
  { startDate, endDate }: { startDate: DateKey; endDate: DateKey },
): ImportItem[] {
  return items.filter((item) => startDate <= item.startDate && item.startDate <= endDate);
}

export function countByCollection(items: readonly ImportItem[]): Record<string, number> {
  return countBy(items, (item) => item.collectionKey);
}

/** 가까운 날짜부터 같은 순서로 나눠야 끊긴 뒤 이어 보낼 때 같은 묶음 번호가 같은 일정을 가리킨다 */
export function chunkItems(items: readonly ImportItem[]): ImportItem[][] {
  const ordered = orderBy(
    uniqBy(items, (item) => item.sourceKey),
    [(item) => item.startDate, (item) => item.localTime ?? '', (item) => item.sourceKey],
    ['asc', 'asc', 'asc'],
  );
  return chunk(ordered, TODO_IMPORT_LIMITS.MAX_ITEMS_PER_CHUNK);
}

// FNV-1a 32비트. 암호용이 아니라 캘린더가 바뀌었는지 가늠하는 값이고 키는 이미 해시다
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const HEX_RADIX = 16;

/** 다시 읽은 캘린더가 같으면 같은 값이라 끊긴 묶음부터 이어 보낸다 */
export function fingerprintItems(chunks: readonly (readonly ImportItem[])[]): string {
  let hash = FNV_OFFSET_BASIS;
  let count = 0;
  for (const item of chunks.flat()) {
    count += 1;
    for (let index = 0; index < item.sourceKey.length; index += 1) {
      hash = Math.imul(hash ^ item.sourceKey.charCodeAt(index), FNV_PRIME);
    }
  }
  return `${count}:${(hash >>> 0).toString(HEX_RADIX)}`;
}
