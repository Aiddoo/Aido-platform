import { TODO_LIMITS } from '@aido/api/vocabulary';
import { dateKeySchema } from '@src/shared/date/date-key';
import { toInstant } from '@src/shared/date/instant';

import { createTodoImportItem } from '../__tests__/todo-import.fixtures';
import {
  findAllDayEndDate,
  getTimedDates,
  normalizeImportTitle,
  TodoImportItemPolicy,
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

describe('findAllDayEndDate', () => {
  it.each([
    ['하루짜리 종일 일정은 끝 날짜가 없다', '2026-11-25', '2026-11-26', null],
    ['사흘짜리는 배타적 끝의 전날이 마지막 날이다', '2026-11-25', '2026-11-28', '2026-11-27'],
    ['연말을 넘는 일정', '2026-12-31', '2027-01-02', '2027-01-01'],
  ])('%s', (_case, startDate, endDateExclusive, expected) => {
    // When
    const endDate = findAllDayEndDate(
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

describe('TodoImportItemPolicy', () => {
  describe('filterByRange', () => {
    it('기간 전에 끝난 하루 일정과 기간 뒤 일정은 뺀다', () => {
      // Given
      const before = createTodoImportItem({
        sourceKey: 'b',
        startDate: dateKeySchema.parse('2026-11-23'),
      });
      const first = createTodoImportItem({
        sourceKey: 'f',
        startDate: dateKeySchema.parse('2026-11-24'),
      });
      const last = createTodoImportItem({
        sourceKey: 'l',
        startDate: dateKeySchema.parse('2026-12-23'),
      });
      const after = createTodoImportItem({
        sourceKey: 'a',
        startDate: dateKeySchema.parse('2026-12-24'),
      });

      // When
      const items = TodoImportItemPolicy.filterByRange([before, first, last, after], {
        startDate: dateKeySchema.parse('2026-11-24'),
        endDate: dateKeySchema.parse('2026-12-23'),
      });

      // Then
      expect(items.map((item) => item.sourceKey)).toEqual(['f', 'l']);
    });

    it.each([
      {
        scenario: '기간 전에 시작해 기간 안까지 이어지는 여러 날 일정은 첫날을 기간 첫날로 당긴다',
        startDate: '2026-11-20',
        endDate: '2026-11-26',
        expected: { startDate: '2026-11-24', endDate: '2026-11-26' },
      },
      {
        scenario: '기간 첫날에 끝나는 여러 날 일정은 기간 첫날 하루 일정이 된다',
        startDate: '2026-11-20',
        endDate: '2026-11-24',
        expected: { startDate: '2026-11-24', endDate: null },
      },
    ])('$scenario', ({ startDate, endDate, expected }) => {
      // Given
      const ongoing = createTodoImportItem({
        startDate: dateKeySchema.parse(startDate),
        endDate: dateKeySchema.parse(endDate),
        localTime: null,
      });

      // When
      const items = TodoImportItemPolicy.filterByRange([ongoing], {
        startDate: dateKeySchema.parse('2026-11-24'),
        endDate: dateKeySchema.parse('2026-12-23'),
      });

      // Then
      expect(items).toEqual([{ ...ongoing, ...expected }]);
    });

    it('기간 전에 끝난 여러 날 일정은 뺀다', () => {
      // Given
      const ended = createTodoImportItem({
        startDate: dateKeySchema.parse('2026-11-20'),
        endDate: dateKeySchema.parse('2026-11-23'),
        localTime: null,
      });

      // When
      const items = TodoImportItemPolicy.filterByRange([ended], {
        startDate: dateKeySchema.parse('2026-11-24'),
        endDate: dateKeySchema.parse('2026-12-23'),
      });

      // Then
      expect(items).toEqual([]);
    });
  });

  describe('calculateCountByCollection', () => {
    it('캘린더마다 일정 수를 센다', () => {
      // Given
      const items = [
        createTodoImportItem({ sourceKey: '1', collectionKey: 'a' }),
        createTodoImportItem({ sourceKey: '2', collectionKey: 'a' }),
        createTodoImportItem({ sourceKey: '3', collectionKey: 'b' }),
      ];

      // When
      const counts = TodoImportItemPolicy.calculateCountByCollection(items);

      // Then
      expect(counts).toEqual({ a: 2, b: 1 });
    });
  });
});
