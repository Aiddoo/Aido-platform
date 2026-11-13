import { act, renderHook } from '@testing-library/react-native';
import { useIsFocused } from 'expo-router';
import { BackHandler } from 'react-native';

import { useAndroidBackHandler } from './use-android-back-handler';

describe('useAndroidBackHandler', () => {
  let subscribe: jest.SpiedFunction<typeof BackHandler.addEventListener>;
  let remove: jest.Mock;

  beforeEach(() => {
    remove = jest.fn();
    subscribe = jest.spyOn(BackHandler, 'addEventListener').mockReturnValue({ remove });
  });

  afterEach(() => {
    subscribe.mockRestore();
  });

  async function pressBack() {
    const subscription = subscribe.mock.calls.at(-1);
    if (subscription == null) {
      throw new Error('뒤로가기 구독이 없어요');
    }
    let isHandled: boolean | undefined;
    await act(() => {
      isHandled = subscription[1]({ type: 'hardwareBackPress', timeStamp: 0 });
    });
    return isHandled;
  }

  it('구독을 유지한 채 최신 onBack을 실행하고 반환값을 그대로 돌려준다', async () => {
    // Given
    const previous = jest.fn(() => false);
    const next = jest.fn(() => true);
    const hook = await renderHook(
      ({ onBack }: { onBack: () => boolean }) => useAndroidBackHandler({ onBack }),
      { initialProps: { onBack: previous } },
    );

    // When
    await hook.rerender({ onBack: next });
    const isHandled = await pressBack();

    // Then
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(previous).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(isHandled).toBe(true);
  });

  it('꺼 두면 구독하지 않고 켜면 구독한다', async () => {
    // Given
    const hook = await renderHook(
      ({ isEnabled }: { isEnabled: boolean }) =>
        useAndroidBackHandler({ isEnabled, onBack: () => true }),
      { initialProps: { isEnabled: false } },
    );

    // When
    const subscribedWhileOff = subscribe.mock.calls.length;
    await hook.rerender({ isEnabled: true });

    // Then
    expect(subscribedWhileOff).toBe(0);
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it('화면이 포커스를 잃으면 구독을 풀고 돌아오면 다시 건다', async () => {
    // Given
    jest.mocked(useIsFocused).mockReturnValue(true);
    const hook = await renderHook(() => useAndroidBackHandler({ onBack: () => true }));

    // When
    jest.mocked(useIsFocused).mockReturnValue(false);
    await hook.rerender({});
    const removedAfterBlur = remove.mock.calls.length;
    jest.mocked(useIsFocused).mockReturnValue(true);
    await hook.rerender({});

    // Then
    expect(removedAfterBlur).toBe(1);
    expect(subscribe).toHaveBeenCalledTimes(2);
  });

  it('꺼지거나 사라지면 구독을 푼다', async () => {
    // Given
    const hook = await renderHook(
      ({ isEnabled }: { isEnabled: boolean }) =>
        useAndroidBackHandler({ isEnabled, onBack: () => true }),
      { initialProps: { isEnabled: true } },
    );

    // When
    await hook.rerender({ isEnabled: false });
    const removedAfterDisable = remove.mock.calls.length;
    await hook.rerender({ isEnabled: true });
    await hook.unmount();

    // Then
    expect(removedAfterDisable).toBe(1);
    expect(remove).toHaveBeenCalledTimes(2);
  });
});
