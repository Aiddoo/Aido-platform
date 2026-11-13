import { isEqual } from 'es-toolkit';
import { match } from 'ts-pattern';

export type StepperContexts = Record<string, object>;

export type StepName<Contexts extends StepperContexts> = keyof Contexts & string;

/** 빈 context 단계는 `Record<string, never>`로 선언한다. 이 단계는 context를 생략할 수 있다 */
type EmptyContext = Record<string, never>;

/** 단계 이름과 그 단계의 context가 짝으로 묶인 판별 유니온. Name을 좁히면 그 단계만 남는다 */
export type StepEntry<
  Contexts extends StepperContexts,
  Name extends StepName<Contexts> = StepName<Contexts>,
> = { [Key in Name]: { step: Key; context: Contexts[Key] } }[Name];

/** 받는 쪽 모양. context가 빈 단계는 context를 생략한다 */
export type StepInput<
  Contexts extends StepperContexts,
  Name extends StepName<Contexts> = StepName<Contexts>,
> = {
  [Key in Name]: EmptyContext extends Contexts[Key]
    ? { step: Key; context?: Contexts[Key] }
    : { step: Key; context: Contexts[Key] };
}[Name];

/** 생략한 context는 빈 단계에서만 타입이 허락해 `{}`로 채워도 그 단계의 context다. 제네릭은 이 관계를 증명하지 못해 구현 시그니처를 넓힌다 */
export function toStepEntry<Contexts extends StepperContexts>(
  input: StepInput<Contexts>,
): StepEntry<Contexts>;
export function toStepEntry(input: { step: string; context?: object }): {
  step: string;
  context: object;
} {
  return { step: input.step, context: input.context ?? {} };
}

export interface StepperState<Contexts extends StepperContexts> {
  entries: readonly StepEntry<Contexts>[];
  cursor: number;
}

export type StepperAction<Contexts extends StepperContexts> =
  | { type: 'push'; entry: StepEntry<Contexts> }
  | { type: 'replace'; entry: StepEntry<Contexts> }
  | { type: 'go'; delta: number };

export function createStepperState<Contexts extends StepperContexts>(
  initial: StepInput<Contexts>,
): StepperState<Contexts> {
  return { entries: [toStepEntry(initial)], cursor: 0 };
}

export function getCurrentEntry<Contexts extends StepperContexts>(
  state: StepperState<Contexts>,
): StepEntry<Contexts> {
  const entry = state.entries[state.cursor];
  if (entry == null) {
    throw new Error('stepper cursor is out of range');
  }
  return entry;
}

/** 렌더러의 같은 핸들러가 연달아 불려도 기록이 늘지 않게 같은 단계·context 호출은 무시한다 */
function push<Contexts extends StepperContexts>(
  state: StepperState<Contexts>,
  entry: StepEntry<Contexts>,
): StepperState<Contexts> {
  if (isEqual(getCurrentEntry(state), entry)) {
    return state;
  }
  return {
    entries: [...state.entries.slice(0, state.cursor + 1), entry],
    cursor: state.cursor + 1,
  };
}

function replace<Contexts extends StepperContexts>(
  state: StepperState<Contexts>,
  entry: StepEntry<Contexts>,
): StepperState<Contexts> {
  if (isEqual(getCurrentEntry(state), entry)) {
    return state;
  }
  return {
    entries: state.entries.map((existing, index) => (index === state.cursor ? entry : existing)),
    cursor: state.cursor,
  };
}

/** 기록 범위를 벗어나는 이동은 무시한다 */
function go<Contexts extends StepperContexts>(
  state: StepperState<Contexts>,
  delta: number,
): StepperState<Contexts> {
  const cursor = state.cursor + delta;
  const isInRange = 0 <= cursor && cursor < state.entries.length;
  if (!Number.isInteger(cursor) || !isInRange) {
    return state;
  }
  return { entries: state.entries, cursor };
}

export function stepperReducer<Contexts extends StepperContexts>(
  state: StepperState<Contexts>,
  action: StepperAction<Contexts>,
): StepperState<Contexts> {
  return match(action)
    .with({ type: 'push' }, ({ entry }) => push(state, entry))
    .with({ type: 'replace' }, ({ entry }) => replace(state, entry))
    .with({ type: 'go' }, ({ delta }) => go(state, delta))
    .exhaustive();
}
