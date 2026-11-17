import { createAiReport } from '../__tests__/report.fixtures';
import { getReportHeadline } from './report-headline.view-model';

function createStats(completionRate: number, prevCompletionRate: number | null) {
  return { totalTodos: 10, completedTodos: 6, completionRate, prevCompletionRate, streakDays: 3 };
}

describe('getReportHeadline', () => {
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
    const headline = getReportHeadline(report);

    // Then
    expect(headline).toEqual(expected);
  });
});
