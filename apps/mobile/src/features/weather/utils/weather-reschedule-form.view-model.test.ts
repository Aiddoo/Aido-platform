import { toRescheduleOutcome } from './weather-reschedule-form.view-model';

describe('toRescheduleOutcome', () => {
  const targets = [{ todo: { id: 1 } }, { todo: { id: 2 } }, { todo: { id: 3 } }];

  it('3개가 모두 실패하면 옮긴 것은 없고 실패 이유 3개를 돌려준다', () => {
    // Given
    const results = targets.map(() => ({ status: 'rejected', reason: new Error('500') }) as const);

    // When
    const outcome = toRescheduleOutcome(targets, results);

    // Then
    expect(outcome.moved).toEqual([]);
    expect(outcome.failures).toHaveLength(3);
  });

  it('일부만 실패하면 성공한 할 일만 옮긴 것으로 센다', () => {
    // Given
    const results = [
      { status: 'fulfilled', value: undefined },
      { status: 'rejected', reason: new Error('500') },
      { status: 'fulfilled', value: undefined },
    ] as const;

    // When
    const outcome = toRescheduleOutcome(targets, results);

    // Then
    expect(outcome.moved).toEqual([{ id: 1 }, { id: 3 }]);
    expect(outcome.failures).toHaveLength(1);
  });
});
