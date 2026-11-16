import { createDateKey } from '@src/testing/date-key';

import { createAiReport } from '../__tests__/report.fixtures';
import { ReportPolicy } from './report.model';

describe('getCompletionRateChange', () => {
  it('지난 기간보다 오르거나 내린 만큼을 반환한다', () => {
    // Given
    const report = createAiReport();

    // When
    const change = ReportPolicy.getCompletionRateChange(report);

    // Then
    // 60 - 75 = -15
    expect(change).toBe(-15);
  });

  it('지난 기간 완료율이 없으면 비교하지 않는다', () => {
    // Given
    const report = createAiReport({
      stats: {
        totalTodos: 10,
        completedTodos: 6,
        completionRate: 60,
        prevCompletionRate: null,
        streakDays: 3,
      },
    });

    // When
    const change = ReportPolicy.getCompletionRateChange(report);

    // Then
    expect(change).toBeNull();
  });
});

describe('getPeakHour', () => {
  it.each([
    {
      scenario: '가장 많이 끝낸 시각을 고른다',
      timePatterns: [
        { hour: 9, count: 2 },
        { hour: 21, count: 7 },
        { hour: 13, count: 4 },
      ],
      expected: 21,
    },
    {
      scenario: '끝낸 수가 같으면 서버가 준 순서와 상관없이 이른 시각을 고른다',
      timePatterns: [
        { hour: 20, count: 3 },
        { hour: 8, count: 3 },
      ],
      expected: 8,
    },
    {
      scenario: '모든 시각이 0이면 고르지 않는다',
      timePatterns: [
        { hour: 9, count: 0 },
        { hour: 13, count: 0 },
      ],
      expected: null,
    },
    { scenario: '끝낸 시각이 없으면 고르지 않는다', timePatterns: [], expected: null },
  ])('$scenario', ({ timePatterns, expected }) => {
    // Given
    const report = createAiReport({ timePatterns });

    // When
    const peakHour = ReportPolicy.getPeakHour(report);

    // Then
    expect(peakHour).toBe(expected);
  });
});

describe('getPerfectDayCount', () => {
  it.each([
    {
      scenario: '할 일을 모두 끝낸 날만 센다',
      dailyCompletions: [
        { date: createDateKey('2026-03-02'), total: 3, completed: 3 },
        { date: createDateKey('2026-03-03'), total: 4, completed: 2 },
        { date: createDateKey('2026-03-04'), total: 1, completed: 1 },
      ],
      expected: 2,
    },
    {
      scenario: '할 일이 없던 날은 모두 끝낸 날로 세지 않는다',
      dailyCompletions: [
        { date: createDateKey('2026-03-02'), total: 0, completed: 0 },
        { date: createDateKey('2026-03-03'), total: 2, completed: 2 },
      ],
      expected: 1,
    },
    { scenario: '날마다의 기록이 없는 옛 리포트는 0일이다', dailyCompletions: null, expected: 0 },
  ])('$scenario', ({ dailyCompletions, expected }) => {
    // Given
    const report = createAiReport({ dailyCompletions });

    // When
    const perfectDayCount = ReportPolicy.getPerfectDayCount(report);

    // Then
    expect(perfectDayCount).toBe(expected);
  });
});
