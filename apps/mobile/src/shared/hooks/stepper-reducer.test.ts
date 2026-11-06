import {
  createStepperState,
  currentEntryOf,
  type StepperState,
  stepperReducer,
} from './stepper-reducer';

type Contexts = {
  email: { email: string };
  password: { email: string; password: string };
  done: Record<string, never>;
};

function givenAt(...entries: StepperState<Contexts>['entries'][number][]) {
  const [first, ...rest] = entries;
  if (first == null) {
    throw new Error('entry required');
  }
  return rest.reduce<StepperState<Contexts>>(
    (state, entry) => stepperReducer(state, { type: 'push', entry }),
    createStepperState<Contexts>(first),
  );
}

describe('stepperReducer', () => {
  it('push는 기록 끝에 단계를 더하고 그 단계로 이동한다', () => {
    // Given
    const state = givenAt({ step: 'email', context: { email: 'a@b.c' } });

    // When
    const next = stepperReducer(state, {
      type: 'push',
      entry: { step: 'password', context: { email: 'a@b.c', password: '' } },
    });

    // Then
    expect(next.cursor).toBe(1);
    expect(currentEntryOf(next).step).toBe('password');
  });

  it('같은 단계에 같은 context를 또 push하면 기록을 늘리지 않는다', () => {
    // Given
    const state = givenAt({ step: 'email', context: { email: 'a@b.c' } });
    const entry = { step: 'password', context: { email: 'a@b.c', password: '' } } as const;
    const once = stepperReducer(state, { type: 'push', entry });

    // When
    const twice = stepperReducer(once, { type: 'push', entry });

    // Then
    expect(twice).toBe(once);
  });

  it('뒤로 간 뒤 push하면 앞으로 가는 기록을 버린다', () => {
    // Given
    const state = givenAt(
      { step: 'email', context: { email: '' } },
      { step: 'password', context: { email: '', password: '' } },
      { step: 'done', context: {} },
    );
    const back = stepperReducer(state, { type: 'go', delta: -2 });

    // When
    const next = stepperReducer(back, {
      type: 'push',
      entry: { step: 'done', context: {} },
    });

    // Then
    expect(next.entries.map((entry) => entry.step)).toEqual(['email', 'done']);
  });

  it('replace는 현재 단계만 바꾸고 기록 길이는 그대로다', () => {
    // Given
    const state = givenAt(
      { step: 'email', context: { email: '' } },
      { step: 'password', context: { email: '', password: '' } },
    );

    // When
    const next = stepperReducer(state, {
      type: 'replace',
      entry: { step: 'done', context: {} },
    });

    // Then
    expect(next.entries.map((entry) => entry.step)).toEqual(['email', 'done']);
    expect(next.cursor).toBe(1);
  });

  it('첫 단계에서 뒤로 가도 상태가 그대로다', () => {
    // Given
    const state = givenAt({ step: 'email', context: { email: '' } });

    // When
    const next = stepperReducer(state, { type: 'go', delta: -1 });

    // Then
    expect(next).toBe(state);
  });

  it.each([5, -3, 0.5, Number.NaN])('go(%s)가 기록 범위를 벗어나면 무시한다', (delta) => {
    // Given
    const state = givenAt(
      { step: 'email', context: { email: '' } },
      { step: 'password', context: { email: '', password: '' } },
    );

    // When
    const next = stepperReducer(state, { type: 'go', delta });

    // Then
    expect(next).toBe(state);
  });

  it('go로 앞 단계로 갔다가 다시 앞으로 갈 수 있다', () => {
    // Given
    const state = givenAt(
      { step: 'email', context: { email: '' } },
      { step: 'password', context: { email: '', password: '' } },
    );
    const back = stepperReducer(state, { type: 'go', delta: -1 });

    // When
    const forward = stepperReducer(back, { type: 'go', delta: 1 });

    // Then
    expect(currentEntryOf(forward).step).toBe('password');
  });
});
