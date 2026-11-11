import { type SubscriptionPlan, SubscriptionPolicy } from '../domains/subscription.model';

export type TrialStampState = 'stamped' | 'waiting' | 'empty';

export type TrialScheduleStep =
  | { kind: 'start'; stamp: 'stamped' }
  | { kind: 'reminder'; dateKey: string; stamp: 'waiting' }
  | { kind: 'charge'; dateKey: string; stamp: 'empty' };

/** 체험 일정 도장 줄. 체험이 없으면 null이고, 알림일이 오늘이거나 지났으면 알림 도장을 빼고 둘이다 */
export function toTrialScheduleSteps(
  plan: SubscriptionPlan,
  todayKey: string,
): TrialScheduleStep[] | null {
  const endDateKey = SubscriptionPolicy.getFreeTrialEndDateKey(plan, todayKey);
  if (endDateKey == null) {
    return null;
  }
  const reminderDateKey = SubscriptionPolicy.getFreeTrialReminderDateKey(plan, todayKey);

  return [
    { kind: 'start', stamp: 'stamped' },
    ...(reminderDateKey == null
      ? []
      : [{ kind: 'reminder', dateKey: reminderDateKey, stamp: 'waiting' } as const]),
    { kind: 'charge', dateKey: endDateKey, stamp: 'empty' },
  ];
}

/**
 * 페이월을 처음 그릴 때는 도장만 조용히 찍고, 사용자가 체험 요금제로 바꿔 일정이 새로 나타날 때만 손끝으로 알린다.
 * `wasVisible`이 null이면 처음 확인하는 때다
 */
export function shouldBuzzOnTrialStamp(wasVisible: boolean | null, isVisible: boolean): boolean {
  return wasVisible === false && isVisible;
}
