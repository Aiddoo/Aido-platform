import type { NudgeLimitInfo } from './todo-nudge.model';
import { TodoNudgePolicy } from './todo-nudge.model';

const REFERENCE_NOW_KST = new Date('2026-02-25T09:00:00.000+09:00');
const SAME_DAY_LATE_KST = new Date('2026-02-25T23:59:59.000+09:00');
const PREVIOUS_DAY_LATE_KST = new Date('2026-02-24T23:59:59.000+09:00');
const SAME_DAY_MORNING_KST = new Date('2026-02-25T10:00:00.000+09:00');
const NEXT_DAY_MORNING_KST = new Date('2026-02-26T10:00:00.000+09:00');

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
      expect(TodoNudgePolicy.canNudgeOnDate(SAME_DAY_LATE_KST, REFERENCE_NOW_KST)).toBe(true);
    });

    test('다른 날짜면 false를 반환한다', () => {
      expect(TodoNudgePolicy.canNudgeOnDate(PREVIOUS_DAY_LATE_KST, REFERENCE_NOW_KST)).toBe(false);
    });
  });

  describe('canNudgeTodoOnDate', () => {
    test('완료된 할 일은 오늘이어도 false를 반환한다', () => {
      expect(
        TodoNudgePolicy.canNudgeTodoOnDate(
          {
            targetDate: SAME_DAY_MORNING_KST,
            isCompleted: true,
          },
          REFERENCE_NOW_KST,
        ),
      ).toBe(false);
    });

    test('미완료 + 오늘이면 true를 반환한다', () => {
      expect(
        TodoNudgePolicy.canNudgeTodoOnDate(
          {
            targetDate: SAME_DAY_MORNING_KST,
            isCompleted: false,
          },
          REFERENCE_NOW_KST,
        ),
      ).toBe(true);
    });

    test('미완료여도 오늘이 아니면 false를 반환한다', () => {
      expect(
        TodoNudgePolicy.canNudgeTodoOnDate(
          {
            targetDate: NEXT_DAY_MORNING_KST,
            isCompleted: false,
          },
          REFERENCE_NOW_KST,
        ),
      ).toBe(false);
    });
  });

  describe('getBannerState', () => {
    test('제한을 모두 사용했으면 limitReached를 반환한다', () => {
      const limitInfo = createLimitInfo({ remainingToday: 0, usedToday: 3 });
      expect(TodoNudgePolicy.getBannerState(limitInfo)).toEqual({ type: 'limitReached' });
    });

    test('무제한 사용자는 available을 반환한다', () => {
      const limitInfo = createLimitInfo({
        isUnlimited: true,
        dailyLimit: null,
        remainingToday: null,
      });
      expect(TodoNudgePolicy.getBannerState(limitInfo)).toEqual({ type: 'available' });
    });

    test('오늘 아직 찌르지 않았으면 available을 반환한다', () => {
      const limitInfo = createLimitInfo({ usedToday: 0, remainingToday: 3 });
      expect(TodoNudgePolicy.getBannerState(limitInfo)).toEqual({ type: 'available' });
    });

    test('remainingToday가 null이어도 available을 반환한다', () => {
      const limitInfo = createLimitInfo({ usedToday: 1, remainingToday: null });
      expect(TodoNudgePolicy.getBannerState(limitInfo)).toEqual({ type: 'available' });
    });

    test('남은 횟수가 있으면 remaining 상태를 반환한다', () => {
      const limitInfo = createLimitInfo({ usedToday: 1, remainingToday: 2, dailyLimit: 3 });
      expect(TodoNudgePolicy.getBannerState(limitInfo)).toEqual({
        type: 'remaining',
        remainingToday: 2,
        dailyLimit: 3,
      });
    });
  });
});
