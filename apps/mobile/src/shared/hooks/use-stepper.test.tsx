import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import { useEffect, useState } from 'react';
import { BackHandler, TextInput } from 'react-native';

import { type Stepper, useStepper } from './use-stepper';

type Contexts = {
  email: { email: string };
  password: { email: string };
  done: Record<string, never>;
};

const INITIAL = { step: 'email', context: { email: '' } } as const;

type BackListener = Parameters<typeof BackHandler.addEventListener>[1];
type BackEvent = Parameters<BackListener>[0];

function givenBackHandler() {
  const listeners: BackListener[] = [];
  const remove = jest.fn();
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_, listener) => {
    listeners.push(listener);
    return { remove };
  });
  return { press: (event: BackEvent) => listeners.at(-1)?.(event), remove };
}

const BACK_EVENT = { type: 'hardwareBackPress', timeStamp: 0 };

describe('useStepper', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('push하면 단계와 index가 바뀌고 context가 좁혀진다', async () => {
    // Given
    const { result } = await renderHook(() =>
      useStepper<Contexts>({ id: 'signup', initial: INITIAL }),
    );

    // When
    await act(async () => {
      result.current.history.push('password', { email: 'a@b.c' });
    });

    // Then
    const { step, context, index } = result.current;
    expect(step).toBe('password');
    expect(index).toBe(1);
    expect(step === 'password' ? context.email : null).toBe('a@b.c');
  });

  it('받은 id를 그대로 돌려준다', async () => {
    // When
    const { result } = await renderHook(() =>
      useStepper<Contexts>({ id: 'signup', initial: INITIAL }),
    );

    // Then
    expect(result.current.id).toBe('signup');
  });

  it('go는 기록 안에서 delta만큼 이동하고 범위를 벗어나면 무시한다', async () => {
    // Given
    const { result } = await renderHook(() =>
      useStepper<Contexts>({ id: 'signup', initial: INITIAL }),
    );
    await act(async () => {
      result.current.history.push('password', { email: '' });
    });

    // When
    await act(async () => {
      result.current.history.go(-1);
    });

    // Then
    expect(result.current.step).toBe('email');

    // When
    await act(async () => {
      result.current.history.go(-1);
    });

    // Then
    expect(result.current.index).toBe(0);
  });

  it('연속으로 빠르게 두 번 push해도 한 단계만 쌓는다', async () => {
    // Given
    const { result } = await renderHook(() =>
      useStepper<Contexts>({ id: 'signup', initial: INITIAL }),
    );

    // When
    await act(async () => {
      result.current.history.push('password', { email: 'a@b.c' });
      result.current.history.push('password', { email: 'a@b.c' });
    });

    // Then
    expect(result.current.historySteps).toHaveLength(2);
  });

  it('onStepChange는 단계마다 한 번만 부른다', async () => {
    // Given
    const onStepChange = jest.fn();
    const { result, rerender } = await renderHook(() =>
      useStepper<Contexts>({ id: 'signup', initial: INITIAL, onStepChange }),
    );

    // When
    await rerender({});
    await act(async () => {
      result.current.history.push('password', { email: '' });
    });
    await rerender({});

    // Then
    expect(onStepChange).toHaveBeenCalledTimes(2);
    expect(onStepChange).toHaveBeenLastCalledWith({
      step: 'password',
      context: { email: '' },
      index: 1,
    });
  });

  it('다시 마운트하면 처음 단계로 돌아가고 처음 단계를 알린다', async () => {
    // Given
    const onStepChange = jest.fn();
    const first = await renderHook(() =>
      useStepper<Contexts>({ id: 'signup', initial: INITIAL, onStepChange }),
    );
    await act(async () => {
      first.result.current.history.push('password', { email: '' });
    });
    await first.unmount();

    // When
    const second = await renderHook(() =>
      useStepper<Contexts>({ id: 'signup', initial: INITIAL, onStepChange }),
    );

    // Then
    expect(second.result.current.step).toBe('email');
    expect(onStepChange).toHaveBeenCalledTimes(3);
  });

  it('Android 뒤로 가기는 앞 단계가 있으면 되돌리고 첫 단계에서는 넘긴다', async () => {
    // Given
    const backHandler = givenBackHandler();
    const { result } = await renderHook(() =>
      useStepper<Contexts>({ id: 'signup', initial: INITIAL }),
    );
    await act(async () => {
      result.current.history.push('password', { email: '' });
    });

    // When
    let handledOnSecond: boolean | null | undefined;
    let handledOnFirst: boolean | null | undefined;
    await act(async () => {
      handledOnSecond = backHandler.press(BACK_EVENT);
    });
    await act(async () => {
      handledOnFirst = backHandler.press(BACK_EVENT);
    });

    // Then
    expect(handledOnSecond).toBe(true);
    expect(handledOnFirst).toBe(false);
    expect(result.current.index).toBe(0);
  });

  it('화면이 사라지면 뒤로 가기 구독을 해제한다', async () => {
    // Given
    const backHandler = givenBackHandler();
    const { unmount } = await renderHook(() =>
      useStepper<Contexts>({ id: 'signup', initial: INITIAL }),
    );

    // When
    await unmount();

    // Then
    expect(backHandler.remove).toHaveBeenCalled();
  });

  it('context가 빈 단계는 context 없이 시작하고 옮긴다', async () => {
    // Given
    const { result } = await renderHook(() =>
      useStepper<Contexts>({ id: 'signup', initial: { step: 'done' } }),
    );

    // When
    await act(async () => {
      result.current.history.push('email', { email: '' });
    });
    await act(async () => {
      result.current.history.push('done');
    });

    // Then
    expect(result.current.historySteps).toEqual([
      { step: 'done', context: {} },
      { step: 'email', context: { email: '' } },
      { step: 'done', context: {} },
    ]);
  });

  it('updater는 부른 순간의 지금 단계 context로 다음 context를 만든다', async () => {
    // Given
    const { result } = await renderHook(() =>
      useStepper<Contexts>({
        id: 'signup',
        initial: { step: 'email', context: { email: 'a@b.c' } },
      }),
    );

    // When
    await act(async () => {
      result.current.history.push('password', (prev) => ({ email: `${prev.email}m` }));
    });
    await act(async () => {
      result.current.history.replace('password', (prev) => ({ email: `${prev.email}!` }));
    });

    // Then
    expect(result.current.historySteps).toEqual([
      { step: 'email', context: { email: 'a@b.c' } },
      { step: 'password', context: { email: 'a@b.cm!' } },
    ]);
  });

  it('이웃 단계에 같은 렌더러를 넘기면 한 화면으로 이어지고 렌더러가 다르면 새로 마운트한다', async () => {
    // Given
    const onMount = jest.fn();
    function StepField({ step }: { step: string }) {
      const [mountedStep] = useState(step);
      useEffect(() => {
        onMount(mountedStep);
      }, [mountedStep]);
      return <TextInput testID="field" value={step} />;
    }
    let stepper: Stepper<Contexts> | null = null;
    function Screen() {
      const current = useStepper<Contexts>({ id: 'signup', initial: INITIAL });
      stepper = current;
      const renderEmailFields = ({ step }: { step: string }) => <StepField step={step} />;
      return (
        <current.Render
          email={renderEmailFields}
          password={renderEmailFields}
          done={() => <StepField step="done" />}
        />
      );
    }
    await render(<Screen />);

    // When
    await act(async () => {
      stepper?.history.push('password', { email: '' });
    });
    await act(async () => {
      stepper?.history.back();
    });
    await act(async () => {
      stepper?.history.push('done');
    });

    // Then
    expect(onMount.mock.calls).toEqual([['email'], ['done']]);
    expect(screen.getByTestId('field').props.value).toBe('done');
  });

  it('부모가 다시 그려져도 Render 안의 입력은 다시 마운트되지 않는다', async () => {
    // Given
    const onMount = jest.fn();
    function EmailField({ value, onChange }: { value: string; onChange: (text: string) => void }) {
      useEffect(() => {
        onMount();
      }, []);
      return <TextInput testID="email-input" value={value} onChangeText={onChange} />;
    }
    function Screen() {
      const [email, setEmail] = useState('');
      const stepper = useStepper<Contexts>({ id: 'signup', initial: INITIAL });
      return (
        <stepper.Render
          email={() => <EmailField value={email} onChange={setEmail} />}
          password={() => null}
          done={() => null}
        />
      );
    }
    await render(<Screen />);

    // When
    await fireEvent.changeText(screen.getByTestId('email-input'), 'abc');
    await fireEvent.changeText(screen.getByTestId('email-input'), 'abcd');

    // Then
    expect(screen.getByTestId('email-input').props.value).toBe('abcd');
    expect(onMount).toHaveBeenCalledTimes(1);
  });
});
