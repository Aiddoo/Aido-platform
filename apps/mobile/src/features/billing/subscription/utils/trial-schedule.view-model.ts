import { type SubscriptionPlan, SubscriptionPolicy } from '../domains/subscription.model';

export type TrialStampState = 'stamped' | 'waiting' | 'empty';

export type TrialScheduleStep =
  | { kind: 'start'; stamp: 'stamped' }
  | { kind: 'reminder'; dateKey: string; stamp: 'waiting' }
  | { kind: 'charge'; dateKey: string; stamp: 'empty' };

/** 체험 일정 도장 줄. 체험이 없으면 null이고, 알림일이 오늘이거나 지났으면 알림 도장을 빼고 둘이다 */
export function toTrialScheduleSteps(
  plan: Pick<SubscriptionPlan, 'freeTrial'>,
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
