import { act, renderHook } from '@testing-library/react-native';
import { BackHandler } from 'react-native';

import { useAndroidSheetBackHandler } from './use-android-sheet-back-handler';

describe('공용 시트의 Android 뒤로가기', () => {
  let subscribe: jest.SpiedFunction<typeof BackHandler.addEventListener>;
  let remove: jest.Mock;

  beforeEach(() => {
    remove = jest.fn();
    subscribe = jest.spyOn(BackHandler, 'addEventListener').mockReturnValue({ remove });
  });

  afterEach(() => {
    subscribe.mockRestore();
  });

  it('열린 시트는 구독을 유지한 채 최신 닫기 동작을 실행하고 화면 뒤로가기를 소비한다', async () => {
    // Given
    const previousClose = jest.fn();
    const nextClose = jest.fn();
    const hook = await renderHook(
      ({ onClose }: { onClose: () => void }) => useAndroidSheetBackHandler(true, onClose),
      { initialProps: { onClose: previousClose } },
    );

    // When
    await hook.rerender({ onClose: nextClose });
    const subscription = subscribe.mock.calls.at(-1);
    if (subscription == null) {
      throw new Error('뒤로가기 구독이 없어요');
    }
    const handleBack = subscription[1];
    let isHandled: boolean | undefined;
    await act(() => {
      isHandled = handleBack({ type: 'hardwareBackPress', timeStamp: 0 });
    });

    // Then
    expect(isHandled).toBe(true);
    expect(nextClose).toHaveBeenCalledTimes(1);
    expect(previousClose).not.toHaveBeenCalled();
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(remove).not.toHaveBeenCalled();
  });

  it('시트가 닫히거나 화면에서 제거되면 뒤로가기 구독을 정리한다', async () => {
    // Given
    const onClose = jest.fn();
    const hook = await renderHook(
      ({ isOpen }: { isOpen: boolean }) => useAndroidSheetBackHandler(isOpen, onClose),
      { initialProps: { isOpen: true } },
    );

    // When
    await hook.rerender({ isOpen: false });
    await hook.unmount();

    // Then
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('닫힌 시트는 Android 뒤로가기를 구독하지 않는다', async () => {
    // Given
    const onClose = jest.fn();

    // When
    await renderHook(() => useAndroidSheetBackHandler(false, onClose));

    // Then
    expect(subscribe).not.toHaveBeenCalled();
  });
});
