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
        perfectDays: null,
      },
    });

    // When
    const change = ReportPolicy.getCompletionRateChange(report);

    // Then
    expect(change).toBeNull();
  });
});
