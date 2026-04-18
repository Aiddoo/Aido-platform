import { type AiUsage, AiUsagePolicy } from './todo.model';

describe('AiUsagePolicy', () => {
  const createUsage = (overrides: Partial<AiUsage> = {}): AiUsage => ({
    used: 0,
    limit: 5,
    resetsAt: '2026-04-30T15:00:00.000Z',
    ...overrides,
  });

  describe('isLimitReached', () => {
    test('무료 사용자의 used가 limit 미만이면 false', () => {
      // Given
      const usage = createUsage({ used: 2, limit: 5 });

      // When
      const result = AiUsagePolicy.isLimitReached(usage);

      // Then
      expect(result).toBe(false);
    });

    test('무료 사용자의 used가 limit과 같으면 true', () => {
      // Given
      const usage = createUsage({ used: 5, limit: 5 });

      // When
      const result = AiUsagePolicy.isLimitReached(usage);

      // Then
      expect(result).toBe(true);
    });

    test('무료 사용자의 used가 limit을 초과하면 true (극단값)', () => {
      // Given: 서버 배포 직후 기존 일일 캐시가 월간으로 바뀌는 전이 구간
      const usage = createUsage({ used: 15, limit: 5 });

      // When
      const result = AiUsagePolicy.isLimitReached(usage);

      // Then
      expect(result).toBe(true);
    });

    test('프리미엄(limit=null)은 used에 관계없이 false', () => {
      // Given
      const usage = createUsage({ used: 100, limit: null });

      // When
      const result = AiUsagePolicy.isLimitReached(usage);

      // Then
      expect(result).toBe(false);
    });
  });

  describe('getRemainingCount', () => {
    test('무료 사용자는 limit - used 를 반환한다', () => {
      // Given
      const usage = createUsage({ used: 2, limit: 5 });

      // When
      const result = AiUsagePolicy.getRemainingCount(usage);

      // Then
      expect(result).toBe(3);
    });

    test('무료 사용자의 used가 limit과 같으면 0을 반환한다', () => {
      // Given
      const usage = createUsage({ used: 5, limit: 5 });

      // When
      const result = AiUsagePolicy.getRemainingCount(usage);

      // Then
      expect(result).toBe(0);
    });

    test('무료 사용자의 used가 limit을 초과하면 음수를 반환한다 (전이 구간)', () => {
      // Given: 실제 UI에서는 0으로 clamp 처리 필요할 수 있음
      const usage = createUsage({ used: 7, limit: 5 });

      // When
      const result = AiUsagePolicy.getRemainingCount(usage);

      // Then
      expect(result).toBe(-2);
    });

    test('프리미엄(limit=null)은 null을 반환한다', () => {
      // Given
      const usage = createUsage({ used: 99, limit: null });

      // When
      const result = AiUsagePolicy.getRemainingCount(usage);

      // Then
      expect(result).toBeNull();
    });
  });
});
