import {
  Fragment,
  type ReactNode,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import {
  createStepperState,
  getCurrentEntry,
  type StepEntry,
  type StepInput,
  type StepName,
  type StepperAction,
  type StepperContexts,
  type StepperState,
  stepperReducer,
  toStepEntry,
} from '../utils/stepper-reducer';
import { useAndroidBackHandler } from './use-android-back-handler';

/** 값이나 지금 단계의 context를 받아 다음 context를 만드는 updater */
type ContextInput<Contexts extends StepperContexts, Name extends StepName<Contexts>> =
  | Contexts[Name]
  | ((prev: Contexts[StepName<Contexts>]) => Contexts[Name]);

/** context가 빈 단계(`Record<string, never>`)는 인자를 생략한다 */
type ContextArgs<Contexts extends StepperContexts, Name extends StepName<Contexts>> =
  Record<string, never> extends Contexts[Name]
    ? [context?: ContextInput<Contexts, Name>]
    : [context: ContextInput<Contexts, Name>];

interface StepperHistory<Contexts extends StepperContexts> {
  push: <Name extends StepName<Contexts>>(step: Name, ...args: ContextArgs<Contexts, Name>) => void;
  replace: <Name extends StepName<Contexts>>(
    step: Name,
    ...args: ContextArgs<Contexts, Name>
  ) => void;
  back: () => void;
  go: (delta: number) => void;
}

interface StepRenderProps<
  Contexts extends StepperContexts,
  Name extends StepName<Contexts> = StepName<Contexts>,
> {
  step: Name;
  context: Contexts[Name];
  history: StepperHistory<Contexts>;
}

/** 단계 이름을 하나라도 빠뜨리면 컴파일 에러가 난다 */
type StepRenderers<Contexts extends StepperContexts> = {
  [Name in StepName<Contexts>]: (props: StepRenderProps<Contexts, Name>) => ReactNode;
};

type StepChange<Contexts extends StepperContexts> = StepEntry<Contexts> & { index: number };

export interface UseStepperOptions<Contexts extends StepperContexts> {
  id: string;
  initial: StepInput<Contexts>;
  onStepChange?: (change: StepChange<Contexts>) => void;
}

export type Stepper<Contexts extends StepperContexts> = StepEntry<Contexts> & {
  id: string;
  index: number;
  historySteps: readonly StepEntry<Contexts>[];
  history: StepperHistory<Contexts>;
  /**
   * 안에서 훅을 쓰는 컴포넌트라 `<stepper.Render … />` JSX로만 그린다. 함수로 부르면 훅이 부모 훅에 섞여 순서가 흔들린다.
   * 이웃 단계에 같은 렌더러 함수를 넘기면 한 화면으로 이어져 다시 마운트되지 않는다(칸이 하나씩 늘어나는 입력에서 키보드가 내려가지 않는다)
   */
  Render: (renderers: StepRenderers<Contexts>) => ReactNode;
};

interface StepperStore<Contexts extends StepperContexts> {
  getState: () => ReturnType<typeof createStepperState<Contexts>>;
  dispatch: (action: StepperAction<Contexts>) => void;
  subscribe: (listener: () => void) => () => void;
}

function createStepperStore<Contexts extends StepperContexts>(
  initial: StepInput<Contexts>,
): StepperStore<Contexts> {
  let state = createStepperState<Contexts>(initial);
  const listeners = new Set<() => void>();

  return {
    getState: () => state,
    dispatch: (action) => {
      const next = stepperReducer(state, action);
      if (next === state) {
        return;
      }
      state = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function isContextUpdater(
  input: object | ((prev: object) => object),
): input is (prev: object) => object {
  return typeof input === 'function';
}

/** updater는 부른 순간의 지금 단계 context를 받는다. 공개 타입이 단계와 context의 짝을 지키고 구현은 넓은 타입으로 만든다 */
function createStepEntry<Contexts extends StepperContexts, Name extends StepName<Contexts>>(
  current: StepEntry<Contexts>,
  step: Name,
  ...args: ContextArgs<Contexts, Name>
): StepEntry<Contexts>;
function createStepEntry(
  current: { context: object },
  step: string,
  input?: object | ((prev: object) => object),
): { step: string; context: object } {
  const context = input != null && isContextUpdater(input) ? input(current.context) : input;
  return toStepEntry({ step, context });
}

function createHistory<Contexts extends StepperContexts>(
  store: StepperStore<Contexts>,
): StepperHistory<Contexts> {
  return {
    push: (step, ...args) =>
      store.dispatch({
        type: 'push',
        entry: createStepEntry(getCurrentEntry(store.getState()), step, ...args),
      }),
    replace: (step, ...args) =>
      store.dispatch({
        type: 'replace',
        entry: createStepEntry(getCurrentEntry(store.getState()), step, ...args),
      }),
    back: () => store.dispatch({ type: 'go', delta: -1 }),
    go: (delta) => store.dispatch({ type: 'go', delta }),
  };
}

function renderStep<Contexts extends StepperContexts, Name extends StepName<Contexts>>(
  renderers: StepRenderers<Contexts>,
  entry: StepEntry<Contexts, Name>,
  history: StepperHistory<Contexts>,
): ReactNode {
  return renderers[entry.step]({ step: entry.step, context: entry.context, history });
}

/** 같은 렌더러를 쓰는 앞 단계까지 거슬러 올라간 첫 단계가 마운트 단위다. 렌더러가 다르면 단계마다 새로 마운트된다 */
function getMountKey<Contexts extends StepperContexts>(
  state: StepperState<Contexts>,
  renderers: StepRenderers<Contexts>,
): string {
  const current = getCurrentEntry(state);
  const renderer = renderers[current.step];
  let start = state.cursor;
  let startStep: string = current.step;
  for (const entry of state.entries.slice(0, state.cursor).reverse()) {
    if (renderers[entry.step] !== renderer) {
      break;
    }
    start -= 1;
    startStep = entry.step;
  }
  return `${start}:${startStep}`;
}

/** Render의 정체성은 훅 생성 때 한 번 정해져 부모가 다시 그려져도 입력 포커스·상태가 유지된다. 렌더러 안에서 훅을 쓰지 않는다 */
function createRender<Contexts extends StepperContexts>(
  store: StepperStore<Contexts>,
  history: StepperHistory<Contexts>,
) {
  return function StepperRender(renderers: StepRenderers<Contexts>) {
    const state = useSyncExternalStore(store.subscribe, store.getState);
    const entry = getCurrentEntry(state);

    return (
      <Fragment key={getMountKey(state, renderers)}>
        {renderStep(renderers, entry, history)}
      </Fragment>
    );
  };
}

/** 라우터와 이어지지 않아 URL로 복원되지 않는다. Android 뒤로 가기는 앞 단계가 있으면 한 단계 되돌린다 */
export function useStepper<Contexts extends StepperContexts>({
  id,
  initial,
  onStepChange,
}: UseStepperOptions<Contexts>): Stepper<Contexts> {
  const [store] = useState(() => createStepperStore<Contexts>(initial));
  const [history] = useState(() => createHistory(store));
  const [Render] = useState(() => createRender(store, history));
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const current = getCurrentEntry(state);
  const lastNotified = useRef<StepEntry<Contexts> | null>(null);
  const notifyStepChange = useEffectEvent((change: StepChange<Contexts>) => {
    onStepChange?.(change);
  });

  useEffect(() => {
    if (lastNotified.current === current) {
      return;
    }
    lastNotified.current = current;
    notifyStepChange({ ...current, index: state.cursor });
  }, [current, state.cursor]);

  useAndroidBackHandler({
    onBack: () => {
      if (store.getState().cursor === 0) {
        return false;
      }
      history.back();
      return true;
    },
  });

  return {
    ...current,
    id,
    index: state.cursor,
    historySteps: state.entries,
    history,
    Render,
  };
}
