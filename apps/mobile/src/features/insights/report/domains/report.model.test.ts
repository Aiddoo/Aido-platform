import { createAiReport } from '../__tests__/report.fixtures';
import { findPeakHour, ReportPolicy } from './report.model';

function createStats(completionRate: number, prevCompletionRate: number | null) {
  return {
    totalTodos: 10,
    completedTodos: 6,
    completionRate,
    prevCompletionRate,
    streakDays: 3,
    perfectDays: null,
  };
}

describe('findPeakHour', () => {
  it.each([
    {
      scenario: '가장 많이 끝낸 시각',
      hourlyCounts: [
        { hour: 21, count: 4 },
        { hour: 7, count: 6 },
      ],
      expected: 7,
    },
    {
      scenario: '같은 수면 이른 시각',
      hourlyCounts: [
        { hour: 21, count: 5 },
        { hour: 7, count: 5 },
      ],
      expected: 7,
    },
    { scenario: '끝낸 할 일이 없으면 null', hourlyCounts: [{ hour: 9, count: 0 }], expected: null },
    { scenario: '기록이 없으면 null', hourlyCounts: [], expected: null },
  ])('$scenario이다', ({ hourlyCounts, expected }) => {
    // When
    const peakHour = findPeakHour(hourlyCounts);

    // Then
    expect(peakHour).toBe(expected);
  });
});

describe('ReportPolicy', () => {
  describe('getHeadline', () => {
    it.each([
      {
        scenario: '할 일이 없던 기간은 활동 없음이다',
        report: createAiReport({ hasActivity: false, stats: createStats(0, 50) }),
        expected: { kind: 'noActivity' },
      },
      {
        scenario: '지난 기간 완료율이 없으면 첫 리포트다',
        report: createAiReport({ stats: createStats(60, null) }),
        expected: { kind: 'firstReport', completionRate: 60 },
      },
      {
        scenario: '지난 기간보다 높으면 오른 만큼을 준다',
        report: createAiReport({ stats: createStats(80, 72) }),
        expected: { kind: 'improved', completionRate: 80, changePoints: 8 },
      },
      {
        scenario: '0.5만 올라도 오름이다',
        report: createAiReport({ stats: createStats(60.5, 60) }),
        expected: { kind: 'improved', completionRate: 60.5, changePoints: 0.5 },
      },
      {
        scenario: '지난 기간보다 낮으면 내린 만큼을 양수로 준다',
        report: createAiReport({ stats: createStats(55, 70) }),
        expected: { kind: 'declined', completionRate: 55, changePoints: 15 },
      },
      {
        scenario: '0.5만 내려도 내림이다',
        report: createAiReport({ stats: createStats(59.5, 60) }),
        expected: { kind: 'declined', completionRate: 59.5, changePoints: 0.5 },
      },
      {
        scenario: '변화가 0이면 같음이다',
        report: createAiReport({ stats: createStats(60, 60) }),
        expected: { kind: 'unchanged', completionRate: 60 },
      },
    ])('$scenario', ({ report, expected }) => {
      // When
      const headline = ReportPolicy.getHeadline(report);

      // Then
      expect(headline).toEqual(expected);
    });
  });

  describe('getHourlyCompletionCounts', () => {
    it('끝낸 일이 있는 시각만 온 기록을 0시부터 23시까지 24칸으로 채운다', () => {
      // Given
      const report = createAiReport({
        timePatterns: [
          { hour: 23, count: 2 },
          { hour: 7, count: 6 },
        ],
      });

      // When
      const counts = ReportPolicy.getHourlyCompletionCounts(report);

      // Then
      expect(counts).toHaveLength(24);
      expect(counts[7]).toBe(6);
      expect(counts[23]).toBe(2);
      expect(counts.filter((count) => count > 0)).toEqual([6, 2]);
    });
  });

  describe('findCompletionRateChange', () => {
    it('지난 기간보다 오르거나 내린 만큼을 반환한다', () => {
      // Given
      const report = createAiReport();

      // When
      const change = ReportPolicy.findCompletionRateChange(report);

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
          perfectDays: null,
        },
      });

      // When
      const change = ReportPolicy.findCompletionRateChange(report);

      // Then
      expect(change).toBeNull();
    });
  });
});
