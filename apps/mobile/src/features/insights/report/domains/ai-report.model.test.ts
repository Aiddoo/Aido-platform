import { AiReportPolicy } from './ai-report.model';

describe('getCompletionRateChange', () => {
  it('지난 기간보다 오르거나 내린 만큼을 반환한다', () => {
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

describe('getCompletionLevel', () => {
  it.each([
    [100, 'high'],
    [80, 'high'],
    [79, 'medium'],
    [50, 'medium'],
    [49, 'low'],
    [0, 'low'],
  ])('요일 완료율 %i%%는 %s 단계다', (rate, expected) => {
    // When
    const level = AiReportPolicy.getCompletionLevel(rate);

    // Then
    expect(level).toBe(expected);
  });
});
