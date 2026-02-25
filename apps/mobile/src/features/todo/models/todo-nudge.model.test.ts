import type { NudgeLimitInfo } from './todo-nudge.model';
import { TodoNudgePolicy } from './todo-nudge.model';

const NOW = new Date('2026-02-25T09:00:00.000+09:00');
const SAME_DAY_LATE = new Date('2026-02-25T23:59:59.000+09:00');
const SAME_DAY_MORNING = new Date('2026-02-25T10:00:00.000+09:00');
const PREVIOUS_DAY = new Date('2026-02-24T23:59:59.000+09:00');
const NEXT_DAY = new Date('2026-02-26T10:00:00.000+09:00');

const createLimitInfo = (overrides?: Partial<NudgeLimitInfo>): NudgeLimitInfo => ({
  dailyLimit: 3,
  usedToday: 0,
  remainingToday: 3,
  isUnlimited: false,
  ...overrides,
});

describe('TodoNudgePolicy', () => {
  describe('canNudgeOnDate', () => {
    test('같은 날짜면 true를 반환한다', () => {
      // Given
      const targetDate = SAME_DAY_LATE;

      // When
      const result = TodoNudgePolicy.canNudgeOnDate(targetDate, NOW);

      // Then
      expect(result).toBe(true);
    });

    test('이전 날짜면 false를 반환한다', () => {
      // Given
      const targetDate = PREVIOUS_DAY;

      // When
      const result = TodoNudgePolicy.canNudgeOnDate(targetDate, NOW);

      // Then
      expect(result).toBe(false);
    });

    test('다음 날짜면 false를 반환한다', () => {
      // Given
      const targetDate = NEXT_DAY;

      // When
      const result = TodoNudgePolicy.canNudgeOnDate(targetDate, NOW);

      // Then
      expect(result).toBe(false);
    });
  });

  describe('canNudgeTodoOnDate', () => {
    test('미완료 + 오늘이면 true를 반환한다', () => {
      // Given
      const input = { targetDate: SAME_DAY_MORNING, isCompleted: false };

      // When
      const result = TodoNudgePolicy.canNudgeTodoOnDate(input, NOW);

      // Then
      expect(result).toBe(true);
    });

    test('완료된 할 일은 오늘이어도 false를 반환한다', () => {
      // Given
      const input = { targetDate: SAME_DAY_MORNING, isCompleted: true };

      // When
      const result = TodoNudgePolicy.canNudgeTodoOnDate(input, NOW);

      // Then
      expect(result).toBe(false);
    });

    test('미완료여도 오늘이 아니면 false를 반환한다', () => {
      // Given
      const input = { targetDate: NEXT_DAY, isCompleted: false };

      // When
      const result = TodoNudgePolicy.canNudgeTodoOnDate(input, NOW);

      // Then
      expect(result).toBe(false);
    });
  });

  describe('normalizeMessage', () => {
    test('null이면 undefined를 반환한다', () => {
      // Given & When
      const result = TodoNudgePolicy.normalizeMessage(null);

      // Then
      expect(result).toBeUndefined();
    });

    test('undefined이면 undefined를 반환한다', () => {
      // Given & When
      const result = TodoNudgePolicy.normalizeMessage(undefined);

      // Then
      expect(result).toBeUndefined();
    });

    test('빈 문자열이면 undefined를 반환한다', () => {
      // Given & When
      const result = TodoNudgePolicy.normalizeMessage('');

      // Then
      expect(result).toBeUndefined();
    });

    test('공백만 있으면 undefined를 반환한다', () => {
      // Given & When
      const result = TodoNudgePolicy.normalizeMessage('   ');

      // Then
      expect(result).toBeUndefined();
    });

    test('앞뒤 공백을 제거한 문자열을 반환한다', () => {
      // Given
      const message = '  화이팅!  ';

      // When
      const result = TodoNudgePolicy.normalizeMessage(message);

      // Then
      expect(result).toBe('화이팅!');
    });
  });

  describe('isMessageTooLong', () => {
    test('200자 이하이면 false를 반환한다', () => {
      // Given
      const message = 'a'.repeat(200);

      // When
      const result = TodoNudgePolicy.isMessageTooLong(message);

      // Then
      expect(result).toBe(false);
    });

    test('201자 이상이면 true를 반환한다', () => {
      // Given
      const message = 'a'.repeat(201);

      // When
      const result = TodoNudgePolicy.isMessageTooLong(message);

      // Then
      expect(result).toBe(true);
    });

    test('null이면 false를 반환한다', () => {
      // Given & When
      const result = TodoNudgePolicy.isMessageTooLong(null);

      // Then
      expect(result).toBe(false);
    });

    test('undefined이면 false를 반환한다', () => {
      // Given & When
      const result = TodoNudgePolicy.isMessageTooLong(undefined);

      // Then
      expect(result).toBe(false);
    });

    test('공백 포함 200자 초과 시 trim 후 판단한다', () => {
      // Given — 앞뒤 공백 제거하면 200자
      const message = ` ${'a'.repeat(200)} `;

      // When
      const result = TodoNudgePolicy.isMessageTooLong(message);

      // Then
      expect(result).toBe(false);
    });
  });

  describe('isLimitReached', () => {
    test('remainingToday가 0이면 true를 반환한다', () => {
      // Given
      const limitInfo = createLimitInfo({ remainingToday: 0 });

      // When
      const result = TodoNudgePolicy.isLimitReached(limitInfo);

      // Then
      expect(result).toBe(true);
    });

    test('remainingToday가 양수이면 false를 반환한다', () => {
      // Given
      const limitInfo = createLimitInfo({ remainingToday: 2 });

      // When
      const result = TodoNudgePolicy.isLimitReached(limitInfo);

      // Then
      expect(result).toBe(false);
    });

    test('remainingToday가 null (무제한)이면 false를 반환한다', () => {
      // Given
      const limitInfo = createLimitInfo({ remainingToday: null });

      // When
      const result = TodoNudgePolicy.isLimitReached(limitInfo);

      // Then
      expect(result).toBe(false);
    });
  });

  describe('getBannerState', () => {
    test('제한을 모두 사용했으면 limitReached를 반환한다', () => {
      // Given
      const limitInfo = createLimitInfo({ remainingToday: 0, usedToday: 3 });

      // When
      const result = TodoNudgePolicy.getBannerState(limitInfo);

      // Then
      expect(result).toEqual({ type: 'limitReached' });
    });

    test('무제한 사용자는 available을 반환한다', () => {
      // Given
      const limitInfo = createLimitInfo({
        isUnlimited: true,
        dailyLimit: null,
        remainingToday: null,
      });

      // When
      const result = TodoNudgePolicy.getBannerState(limitInfo);

      // Then
      expect(result).toEqual({ type: 'available' });
    });

    test('오늘 아직 찌르지 않았으면 available을 반환한다', () => {
      // Given
      const limitInfo = createLimitInfo({ usedToday: 0, remainingToday: 3 });

      // When
      const result = TodoNudgePolicy.getBannerState(limitInfo);

      // Then
      expect(result).toEqual({ type: 'available' });
    });

    test('remainingToday가 null이어도 available을 반환한다', () => {
      // Given
      const limitInfo = createLimitInfo({ usedToday: 1, remainingToday: null });

      // When
      const result = TodoNudgePolicy.getBannerState(limitInfo);

      // Then
      expect(result).toEqual({ type: 'available' });
    });

    test('남은 횟수가 있으면 remaining 상태를 반환한다', () => {
      // Given
      const limitInfo = createLimitInfo({ usedToday: 1, remainingToday: 2, dailyLimit: 3 });

      // When
      const result = TodoNudgePolicy.getBannerState(limitInfo);

      // Then
      expect(result).toEqual({ type: 'remaining', remainingToday: 2, dailyLimit: 3 });
    });
  });
});
