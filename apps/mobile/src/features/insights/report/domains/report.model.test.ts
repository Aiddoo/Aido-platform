import { toInstant } from '@src/shared/date/instant';

import {
  type AiReport,
  aiReportSchema,
  ReportPolicy,
  type ReportStatus,
  ReportStatusPolicy,
  reportStatusSchema,
} from './report.model';

function createAiReport(overrides: Partial<AiReport> = {}) {
  return aiReportSchema.parse({
    id: 1,
    type: 'WEEKLY',
    year: 2026,
    period: 10,
    dateRange: { startDate: '2026-03-02', endDate: '2026-03-08' },
    stats: {
      totalTodos: 10,
      completedTodos: 6,
      completionRate: 60,
      prevCompletionRate: 75,
      streakDays: 3,
    },
    categoryBreakdown: [],
    dayPatterns: [],
    timePatterns: [],
    aiSummary: '',
    aiTips: [],
    hasActivity: true,
    generatedAt: toInstant('2026-03-09T00:00:00.000Z'),
    ...overrides,
  });
}

function createReportStatus(overrides: Partial<ReportStatus> = {}) {
  return reportStatusSchema.parse({ daysUntilWeekly: 3, daysUntilMonthly: 20, ...overrides });
}

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

describe('getCompletionLevel', () => {
  it.each([
    [100, 'high'],
    [80, 'high'],
    [79, 'medium'],
    [50, 'medium'],
    [49, 'low'],
    [0, 'low'],
  ])('요일 완료율 %i%%는 %s 단계다', (rate, expected) => {
    // Given
    const dayPattern = { day: 'MON' as const, total: 10, completed: 5, rate };

    // When
    const level = ReportPolicy.getCompletionLevel(dayPattern);

    // Then
    expect(level).toBe(expected);
  });
});

describe('getMostActiveHours', () => {
  it('할 일을 많이 한 시간부터 고른 수만큼만 돌려준다', () => {
    // Given
    const report = createAiReport({
      timePatterns: [
        { hour: 9, count: 2 },
        { hour: 13, count: 7 },
        { hour: 21, count: 4 },
        { hour: 7, count: 1 },
      ],
    });

    // When
    const hours = ReportPolicy.getMostActiveHours(report, 3);

    // Then
    expect(hours.map(({ hour }) => hour)).toEqual([13, 21, 9]);
  });

  it('횟수가 같으면 서버가 준 순서를 지킨다', () => {
    // Given
    const report = createAiReport({
      timePatterns: [
        { hour: 8, count: 3 },
        { hour: 20, count: 3 },
      ],
    });

    // When
    const hours = ReportPolicy.getMostActiveHours(report, 3);

    // Then
    expect(hours.map(({ hour }) => hour)).toEqual([8, 20]);
  });
});

describe('getDaysUntilReport', () => {
  it.each([
    ['WEEKLY', 3],
    ['MONTHLY', 20],
  ] as const)('%s 리포트는 그 종류의 남은 날짜를 읽는다', (type, expected) => {
    // Given
    const status = createReportStatus();

    // When
    const days = ReportStatusPolicy.getDaysUntilReport(status, type);

    // Then
    expect(days).toBe(expected);
  });
});
