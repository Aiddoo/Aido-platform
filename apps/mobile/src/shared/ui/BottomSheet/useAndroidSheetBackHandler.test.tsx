import { act, renderHook } from '@testing-library/react-native';
import { BackHandler, Platform } from 'react-native';

import { useAndroidSheetBackHandler } from './useAndroidSheetBackHandler';

describe('공용 시트의 Android 뒤로가기', () => {
  const originalPlatform = Platform.OS;
  let subscribe: jest.SpiedFunction<typeof BackHandler.addEventListener>;
  let remove: jest.Mock;

  beforeEach(() => {
    Platform.OS = 'android';
    remove = jest.fn();
    subscribe = jest.spyOn(BackHandler, 'addEventListener').mockReturnValue({ remove });
  });

  afterEach(() => {
    subscribe.mockRestore();
    Platform.OS = originalPlatform;
  });

  it('열린 시트는 최신 닫기 동작을 실행하고 화면 뒤로가기를 소비한다', async () => {
    // Given
    const previousDismiss = jest.fn();
    const nextDismiss = jest.fn();
    const hook = await renderHook(
      ({ onDismiss }: { onDismiss: () => void }) => useAndroidSheetBackHandler(true, onDismiss),
      { initialProps: { onDismiss: previousDismiss } },
    );

    // When
    await hook.rerender({ onDismiss: nextDismiss });
    const subscription = subscribe.mock.calls.at(-1);
    if (subscription === undefined) throw new Error('뒤로가기 구독이 없어요');
    const handleBack = subscription[1];
    let isHandled: boolean | undefined;
    await act(() => {
      isHandled = handleBack({ type: 'hardwareBackPress', timeStamp: 0 });
    });

    // Then
    expect(isHandled).toBe(true);
    expect(nextDismiss).toHaveBeenCalledTimes(1);
    expect(previousDismiss).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('시트가 닫히거나 화면에서 제거되면 뒤로가기 구독을 정리한다', async () => {
    // Given
    const onDismiss = jest.fn();
    const hook = await renderHook(
      ({ isVisible }: { isVisible: boolean }) => useAndroidSheetBackHandler(isVisible, onDismiss),
      { initialProps: { isVisible: true } },
    );

    // When
    await hook.rerender({ isVisible: false });
    await hook.unmount();

    // Then
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('닫힌 시트와 iOS 화면은 Android 뒤로가기를 구독하지 않는다', async () => {
    // Given
    const onDismiss = jest.fn();

    // When
    await renderHook(() => useAndroidSheetBackHandler(false, onDismiss));
    Platform.OS = 'ios';
    await renderHook(() => useAndroidSheetBackHandler(true, onDismiss));

    // Then
    expect(subscribe).not.toHaveBeenCalled();
  });
});
