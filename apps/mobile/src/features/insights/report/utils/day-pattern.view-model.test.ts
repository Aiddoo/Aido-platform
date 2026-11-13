import { getDayPatternLevel } from './day-pattern.view-model';

describe('getDayPatternLevel', () => {
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
    const level = getDayPatternLevel(dayPattern);

    // Then
    expect(level).toBe(expected);
  });
});
