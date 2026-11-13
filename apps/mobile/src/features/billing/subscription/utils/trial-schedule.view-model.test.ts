import { createDateKey } from '@src/testing/date-key';

import { createSubscriptionPlan } from '../__tests__/subscription.fixtures';
import { shouldBuzzOnTrialStamp, toTrialScheduleSteps } from './trial-schedule.view-model';

describe('toTrialScheduleSteps', () => {
  it.each([
    ['2주 체험', { periodUnit: 'week', periodNumberOfUnits: 2 }, '2026-11-20', '2026-11-23'],
    [
      '14일로 실린 2주 체험',
      { periodUnit: 'day', periodNumberOfUnits: 14 },
      '2026-11-20',
      '2026-11-23',
    ],
    ['1주 체험', { periodUnit: 'week', periodNumberOfUnits: 1 }, '2026-11-13', '2026-11-16'],
    ['1개월 체험', { periodUnit: 'month', periodNumberOfUnits: 1 }, '2026-12-06', '2026-12-09'],
  ] as const)(
    '%s은 오늘 시작, 끝나기 3일 전 알림, 끝나는 날 첫 결제다',
    (_case, freeTrial, reminderDateKey, chargeDateKey) => {
      // Given
      const plan = createSubscriptionPlan({ freeTrial });

      // When
      const steps = toTrialScheduleSteps(plan, createDateKey('2026-11-09'));

      // Then
      expect(steps).toEqual([
        { kind: 'start', stamp: 'stamped' },
        { kind: 'reminder', dateKey: reminderDateKey, stamp: 'waiting' },
        { kind: 'charge', dateKey: chargeDateKey, stamp: 'empty' },
      ]);
    },
  );

  it('체험 자격이 없으면 일정이 없다', () => {
    // Given
    const plan = createSubscriptionPlan({ freeTrial: null });

    // When
    const steps = toTrialScheduleSteps(plan, createDateKey('2026-11-09'));

    // Then
    expect(steps).toBeNull();
  });

  it('3일 체험은 알림일이 오늘이라 알림 없이 시작과 첫 결제만 남는다', () => {
    // Given
    const plan = createSubscriptionPlan({
      freeTrial: { periodUnit: 'day', periodNumberOfUnits: 3 },
    });

    // When
    const steps = toTrialScheduleSteps(plan, createDateKey('2026-11-09'));

    // Then
    expect(steps).toEqual([
      { kind: 'start', stamp: 'stamped' },
      { kind: 'charge', dateKey: '2026-11-12', stamp: 'empty' },
    ]);
  });
});

describe('shouldBuzzOnTrialStamp', () => {
  it.each([
    ['페이월을 처음 그릴 때 체험 일정이 보이면 울리지 않는다', null, true, false],
    ['체험 없는 요금제에서 체험 요금제로 바꿔 일정이 나타나면 울린다', false, true, true],
    ['체험 요금제끼리 바꿔 일정이 그대로 보이면 울리지 않는다', true, true, false],
    ['체험 없는 요금제로 바꿔 일정이 사라지면 울리지 않는다', true, false, false],
  ])('%s', (_, wasVisible, isVisible, expected) => {
    // When
    const shouldBuzz = shouldBuzzOnTrialStamp(wasVisible, isVisible);

    // Then
    expect(shouldBuzz).toBe(expected);
  });
});
