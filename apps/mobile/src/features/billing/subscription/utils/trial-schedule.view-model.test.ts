import { createSubscriptionPlan } from '../__tests__/subscription.fixtures';
import { toTrialScheduleSteps } from './trial-schedule.view-model';

const ONE_MONTH_TRIAL = { periodUnit: 'month', periodNumberOfUnits: 1 } as const;

describe('toTrialScheduleSteps', () => {
  it('1개월 체험은 오늘 시작, 끝나기 3일 전 알림, 끝나는 날 첫 결제다', () => {
    // Given
    const plan = createSubscriptionPlan({ freeTrial: ONE_MONTH_TRIAL });

    // When
    const steps = toTrialScheduleSteps(plan, '2026-11-09');

    // Then
    expect(steps).toEqual([
      { kind: 'start', stamp: 'stamped' },
      { kind: 'reminder', dateKey: '2026-12-06', stamp: 'waiting' },
      { kind: 'charge', dateKey: '2026-12-09', stamp: 'empty' },
    ]);
  });

  it.each([
    ['평년 1월 31일에 시작하면 2월 28일', '2027-01-31', '2027-02-25', '2027-02-28'],
    ['윤년 1월 31일에 시작하면 2월 29일', '2028-01-31', '2028-02-26', '2028-02-29'],
  ])('%s에 첫 결제다', (_case, todayKey, reminderDateKey, chargeDateKey) => {
    // Given
    const plan = createSubscriptionPlan({ freeTrial: ONE_MONTH_TRIAL });

    // When
    const steps = toTrialScheduleSteps(plan, todayKey);

    // Then
    expect(steps).toEqual([
      { kind: 'start', stamp: 'stamped' },
      { kind: 'reminder', dateKey: reminderDateKey, stamp: 'waiting' },
      { kind: 'charge', dateKey: chargeDateKey, stamp: 'empty' },
    ]);
  });

  it('체험 자격이 없으면 일정이 없다', () => {
    // Given
    const plan = createSubscriptionPlan({ freeTrial: null });

    // When
    const steps = toTrialScheduleSteps(plan, '2026-11-09');

    // Then
    expect(steps).toBeNull();
  });

  it('3일 체험은 알림일이 오늘이라 알림 없이 시작과 첫 결제만 남는다', () => {
    // Given
    const plan = createSubscriptionPlan({
      freeTrial: { periodUnit: 'day', periodNumberOfUnits: 3 },
    });

    // When
    const steps = toTrialScheduleSteps(plan, '2026-11-09');

    // Then
    expect(steps).toEqual([
      { kind: 'start', stamp: 'stamped' },
      { kind: 'charge', dateKey: '2026-11-12', stamp: 'empty' },
    ]);
  });
});
