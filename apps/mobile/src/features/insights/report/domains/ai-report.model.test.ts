import { AiReportPolicy } from './ai-report.model';

describe('AiReportPolicy.getCompletionRateChange', () => {
  it('지난 기간보다 오르거나 내린 만큼을 돌려준다', () => {
    // Given
    const stats = { completionRate: 60, prevCompletionRate: 75 };

    // When
    const change = AiReportPolicy.getCompletionRateChange(stats);

    // Then
    expect(change).toBe(-15);
  });

  it('지난 기간 완료율이 없으면 비교하지 않는다', () => {
    // Given
    const stats = { completionRate: 60, prevCompletionRate: null };

    // When
    const change = AiReportPolicy.getCompletionRateChange(stats);

    // Then
    expect(change).toBeNull();
  });
});
