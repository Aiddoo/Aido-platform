import { dateKeySchema } from '@src/shared/date/date-key';

import {
  calculateRangeEndDate,
  createDefaultTodoImportRange,
  isDateWithinHorizon,
  TodoImportRangePolicy,
} from './todo-import-range.model';

const TODAY = dateKeySchema.parse('2026-11-24');
const FREE_HORIZON_DAYS = 30;

describe('calculateRangeEndDate', () => {
  it.each([
    ['1주는 오늘 포함 7일째', 7, '2026-11-30'],
    ['1개월은 30일이라 31일짜리 달에도 무료 기간 안이다', 30, '2026-12-23'],
    ['1년은 365일째', 365, '2027-11-23'],
  ])('%s', (_case, days, expected) => {
    // When
    const endDate = calculateRangeEndDate(TODAY, days);

    // Then
    expect(endDate).toBe(expected);
  });

  it('윤년 2월 29일을 건너뛰지 않는다', () => {
    // Given
    const startDate = dateKeySchema.parse('2028-02-01');

    // When
    const endDate = calculateRangeEndDate(startDate, 30);

    // Then
    expect(endDate).toBe('2028-03-01');
  });
});

describe('isDateWithinHorizon', () => {
  it.each([
    ['무료 30일의 마지막 날은 된다', '2026-12-23', FREE_HORIZON_DAYS, true],
    ['무료 31일째는 안 된다', '2026-12-24', FREE_HORIZON_DAYS, false],
    ['오늘 이전은 안 된다', '2026-11-23', FREE_HORIZON_DAYS, false],
    ['기간 제한이 없으면(관리자) 먼 날도 된다', '2028-01-01', null, true],
  ])('%s', (_case, date, horizonDays, expected) => {
    // When
    const isWithinHorizon = isDateWithinHorizon(dateKeySchema.parse(date), TODAY, horizonDays);

    // Then
    expect(isWithinHorizon).toBe(expected);
  });
});

describe('createDefaultTodoImportRange', () => {
  it('오늘부터 1개월(30일)이다', () => {
    // When
    const range = createDefaultTodoImportRange(TODAY);

    // Then
    expect(range).toEqual({ startDate: '2026-11-24', endDate: '2026-12-23' });
  });
});

describe('TodoImportRangePolicy', () => {
  describe('findPreset', () => {
    it.each([
      ['빠른 선택과 같은 끝 날이면 그 선택이다', '2026-11-30', 'week'],
      ['직접 고른 끝 날은 없다', '2026-12-01', null],
    ])('%s', (_case, endDate, expected) => {
      // Given
      const range = { startDate: TODAY, endDate: dateKeySchema.parse(endDate) };

      // When
      const preset = TodoImportRangePolicy.findPreset(range);

      // Then
      expect(preset).toBe(expected);
    });
  });

  describe('withStartDate', () => {
    it('끝 날이 새 첫날보다 앞서면 끝 날을 첫날로 당긴다', () => {
      // Given
      const range = createDefaultTodoImportRange(TODAY);
      const startDate = dateKeySchema.parse('2027-01-10');

      // When
      const next = TodoImportRangePolicy.withStartDate(range, startDate);

      // Then
      expect(next).toEqual({ startDate: '2027-01-10', endDate: '2027-01-10' });
    });

    it('끝 날이 새 첫날 뒤면 끝 날은 그대로다', () => {
      // Given
      const range = createDefaultTodoImportRange(TODAY);
      const startDate = dateKeySchema.parse('2026-12-01');

      // When
      const next = TodoImportRangePolicy.withStartDate(range, startDate);

      // Then
      expect(next).toEqual({ startDate: '2026-12-01', endDate: '2026-12-23' });
    });
  });

  describe('withPreset', () => {
    it('첫날은 그대로 두고 첫날부터 센 끝 날로 바꾼다', () => {
      // Given
      const range = {
        startDate: dateKeySchema.parse('2026-12-01'),
        endDate: dateKeySchema.parse('2026-12-01'),
      };

      // When
      const next = TodoImportRangePolicy.withPreset(range, 'week');

      // Then
      expect(next).toEqual({ startDate: '2026-12-01', endDate: '2026-12-07' });
    });
  });

  describe('canUsePreset', () => {
    it.each([
      { preset: 'week', horizonDays: 30, expected: true },
      { preset: 'month', horizonDays: 30, expected: true },
      { preset: 'quarter', horizonDays: 30, expected: false },
      { preset: 'year', horizonDays: null, expected: true },
    ] as const)(
      '$preset은 한도 $horizonDays일에서 $expected다',
      ({ preset, horizonDays, expected }) => {
        // Given
        const range = createDefaultTodoImportRange(TODAY);

        // When
        const canUse = TodoImportRangePolicy.canUsePreset(range, preset, TODAY, horizonDays);

        // Then
        expect(canUse).toBe(expected);
      },
    );

    it('첫날을 뒤로 미루면 한도 안이던 빠른 선택도 한도를 넘는다', () => {
      // Given
      const range = {
        startDate: dateKeySchema.parse('2026-12-01'),
        endDate: dateKeySchema.parse('2026-12-01'),
      };

      // When
      const canUse = TodoImportRangePolicy.canUsePreset(range, 'month', TODAY, FREE_HORIZON_DAYS);

      // Then
      expect(canUse).toBe(false);
    });
  });
});
