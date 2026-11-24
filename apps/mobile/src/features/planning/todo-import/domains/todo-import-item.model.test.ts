import { TODO_IMPORT_LIMITS, TODO_LIMITS } from '@aido/api/vocabulary';
import { dateKeySchema } from '@src/shared/date/date-key';
import { toInstant } from '@src/shared/date/instant';
import { range } from 'es-toolkit';

import { createImportItem } from '../__tests__/todo-import.fixtures';
import {
  chunkItems,
  countByCollection,
  filterByRange,
  fingerprintItems,
  getAllDayEndDate,
  getTimedDates,
  normalizeImportTitle,
} from './todo-import-item.model';

const UNTITLED = '제목 없는 일정';

describe('normalizeImportTitle', () => {
  it.each([
    ['줄바꿈·탭은 빈칸 하나가 된다', '회의\n\t준비\r\n자료', '회의 준비 자료'],
    ['줄 구분 문자도 빈칸이 된다', `발표 연습`, '발표 연습'],
    ['앞뒤 공백을 지운다', '  산책  ', '산책'],
    ['비면 받은 문구를 쓴다', ' \n ', UNTITLED],
    ['없으면 받은 문구를 쓴다', null, UNTITLED],
  ])('%s', (_case, title, expected) => {
    // When
    const normalized = normalizeImportTitle(title, UNTITLED);

    // Then
    expect(normalized).toBe(expected);
  });

  it('한도를 넘는 제목은 이모지를 반으로 자르지 않고 한도 안까지만 남긴다', () => {
    // Given
    const title = `${'가'.repeat(TODO_LIMITS.TITLE_MAX_LENGTH - 1)}👩‍👩‍👧끝`;

    // When
    const normalized = normalizeImportTitle(title, UNTITLED);

    // Then
    expect(normalized).toBe('가'.repeat(TODO_LIMITS.TITLE_MAX_LENGTH - 1));
    expect(normalized.length).toBeLessThanOrEqual(TODO_LIMITS.TITLE_MAX_LENGTH);
  });
});

describe('getAllDayEndDate', () => {
  it.each([
    ['하루짜리 종일 일정은 끝 날짜가 없다', '2026-11-25', '2026-11-26', null],
    ['사흘짜리는 배타적 끝의 전날이 마지막 날이다', '2026-11-25', '2026-11-28', '2026-11-27'],
    ['연말을 넘는 일정', '2026-12-31', '2027-01-02', '2027-01-01'],
  ])('%s', (_case, startDate, endDateExclusive, expected) => {
    // When
    const endDate = getAllDayEndDate(
      dateKeySchema.parse(startDate),
      dateKeySchema.parse(endDateExclusive),
    );

    // Then
    expect(endDate).toBe(expected);
  });
});

describe('getTimedDates', () => {
  it.each([
    ['서울 자정 직전', '2026-11-24T14:59:00.000Z', 'Asia/Seoul', '2026-11-24', '23:59'],
    ['서울 자정 정각은 다음 날', '2026-11-24T15:00:00.000Z', 'Asia/Seoul', '2026-11-25', '00:00'],
    [
      '같은 순간도 LA는 전날',
      '2026-11-24T15:00:00.000Z',
      'America/Los_Angeles',
      '2026-11-24',
      '07:00',
    ],
    [
      'LA 서머타임 시작 날',
      '2026-03-08T10:30:00.000Z',
      'America/Los_Angeles',
      '2026-03-08',
      '03:30',
    ],
    ['LA 서머타임 끝 날', '2026-11-01T09:30:00.000Z', 'America/Los_Angeles', '2026-11-01', '01:30'],
  ])('%s', (_case, startsAt, timezone, startDate, localTime) => {
    // When
    const dates = getTimedDates(toInstant(startsAt), { timezone, timeMode: 'TIME' });

    // Then
    expect(dates).toEqual({ startDate, localTime });
  });

  it('날짜만 가져오면 시각을 버려 알림이 예약되지 않는다', () => {
    // When
    const dates = getTimedDates(toInstant('2026-11-24T01:00:00.000Z'), {
      timezone: 'Asia/Seoul',
      timeMode: 'DATE_ONLY',
    });

    // Then
    expect(dates).toEqual({ startDate: '2026-11-24', localTime: null });
  });
});

describe('filterByRange', () => {
  it('기간 전에 시작한 일정과 기간 뒤 일정은 뺀다', () => {
    // Given
    const before = createImportItem({
      sourceKey: 'b',
      startDate: dateKeySchema.parse('2026-11-23'),
    });
    const first = createImportItem({
      sourceKey: 'f',
      startDate: dateKeySchema.parse('2026-11-24'),
    });
    const last = createImportItem({ sourceKey: 'l', startDate: dateKeySchema.parse('2026-12-23') });
    const after = createImportItem({
      sourceKey: 'a',
      startDate: dateKeySchema.parse('2026-12-24'),
    });

    // When
    const items = filterByRange([before, first, last, after], {
      startDate: dateKeySchema.parse('2026-11-24'),
      endDate: dateKeySchema.parse('2026-12-23'),
    });

    // Then
    expect(items.map((item) => item.sourceKey)).toEqual(['f', 'l']);
  });
});

describe('countByCollection', () => {
  it('캘린더마다 일정 수를 센다', () => {
    // Given
    const items = [
      createImportItem({ sourceKey: '1', collectionKey: 'a' }),
      createImportItem({ sourceKey: '2', collectionKey: 'a' }),
      createImportItem({ sourceKey: '3', collectionKey: 'b' }),
    ];

    // When
    const counts = countByCollection(items);

    // Then
    expect(counts).toEqual({ a: 2, b: 1 });
  });
});

describe('chunkItems', () => {
  it('같은 키는 한 번만, 가까운 날짜·시각 순으로 100개씩 나눈다', () => {
    // Given
    const items = range(TODO_IMPORT_LIMITS.MAX_ITEMS_PER_CHUNK + 1).map((index) =>
      createImportItem({
        sourceKey: String(index).padStart(4, '0'),
        startDate: dateKeySchema.parse(index === 0 ? '2026-12-01' : '2026-11-30'),
      }),
    );
    const duplicate = createImportItem({ sourceKey: '0001' });

    // When
    const chunks = chunkItems([...items, duplicate]);

    // Then
    expect(chunks.map((chunk) => chunk.length)).toEqual([
      TODO_IMPORT_LIMITS.MAX_ITEMS_PER_CHUNK,
      1,
    ]);
    expect(chunks.at(-1)?.[0]?.sourceKey).toBe('0000');
  });

  it('날짜가 같으면 종일(시각 없음)이 먼저이고 그다음 이른 시각이다', () => {
    // Given
    const evening = createImportItem({ sourceKey: 'e', localTime: '19:00' });
    const allDay = createImportItem({ sourceKey: 'd', localTime: null });
    const morning = createImportItem({ sourceKey: 'm', localTime: '08:00' });

    // When
    const [chunk] = chunkItems([evening, allDay, morning]);

    // Then
    expect(chunk?.map((item) => item.sourceKey)).toEqual(['d', 'm', 'e']);
  });
});

describe('fingerprintItems', () => {
  it('다시 읽은 일정이 같으면 순서가 달라도 같은 지문이고, 하나라도 다르면 다른 지문이다', () => {
    // Given
    const first = createImportItem({ sourceKey: '1'.repeat(64) });
    const second = createImportItem({ sourceKey: '2'.repeat(64) });
    const other = createImportItem({ sourceKey: '3'.repeat(64) });

    // When
    const original = fingerprintItems(chunkItems([first, second]));
    const reread = fingerprintItems(chunkItems([second, first]));
    const changed = fingerprintItems(chunkItems([first, other]));

    // Then
    expect(reread).toBe(original);
    expect(changed).not.toBe(original);
  });
});
