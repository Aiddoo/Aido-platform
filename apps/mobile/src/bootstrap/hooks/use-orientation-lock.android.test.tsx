import {
  createScreenOrientationGatewayStub,
  stubWindowDimensions,
  createTestDi,
} from '@src/testing/core';
import { renderScreenHook } from '@src/testing/render';
import { DEVICE_WINDOW } from '@src/testing/window-layout.fixtures';

import { useOrientationLock } from './use-orientation-lock';

describe('useOrientationLock (Android)', () => {
  it('창이 바뀌어도 결정이 같으면 다시 요청하지 않는다', async () => {
    // Given
    const screenOrientation = createScreenOrientationGatewayStub();
    stubWindowDimensions(DEVICE_WINDOW.phone.width, DEVICE_WINDOW.phone.height);
    const { rerender } = await renderScreenHook(() => useOrientationLock(), {
      di: createTestDi({ ports: { screenOrientation } }),
    });

    // When
    stubWindowDimensions(DEVICE_WINDOW.phone.width, DEVICE_WINDOW.phone.height - 48);
    await rerender(undefined);

    // Then
    expect(screenOrientation.lockPortrait).toHaveBeenCalledTimes(1);
    expect(screenOrientation.unlock).not.toHaveBeenCalled();
  });

  it('분할 화면에서 시스템이 세로 요청을 무시해 창이 그대로여도 다시 요청하지 않는다', async () => {
    // Given
    const screenOrientation = createScreenOrientationGatewayStub();
    const { width, height } = DEVICE_WINDOW.phoneSplitScreenHalf;
    stubWindowDimensions(width, height);
    const { rerender } = await renderScreenHook(() => useOrientationLock(), {
      di: createTestDi({ ports: { screenOrientation } }),
    });

    // When
    await rerender(undefined);
    await rerender(undefined);

    // Then
    expect(screenOrientation.lockPortrait).toHaveBeenCalledTimes(1);
  });

  it('펼치면 풀고 다시 접으면 세로로 묶는다', async () => {
    // Given
    const screenOrientation = createScreenOrientationGatewayStub();
    stubWindowDimensions(DEVICE_WINDOW.foldedOuter.width, DEVICE_WINDOW.foldedOuter.height);
    const { rerender } = await renderScreenHook(() => useOrientationLock(), {
      di: createTestDi({ ports: { screenOrientation } }),
    });

    // When
    stubWindowDimensions(DEVICE_WINDOW.unfoldedInner.width, DEVICE_WINDOW.unfoldedInner.height);
    await rerender(undefined);
    stubWindowDimensions(DEVICE_WINDOW.foldedOuter.width, DEVICE_WINDOW.foldedOuter.height);
    await rerender(undefined);

    // Then
    expect(screenOrientation.lockPortrait).toHaveBeenCalledTimes(2);
    expect(screenOrientation.unlock).toHaveBeenCalledTimes(1);
  });
});
