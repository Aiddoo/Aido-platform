import {
  createScreenOrientationGatewayStub,
  renderUiHook,
  stubWindowDimensions,
} from '@src/shared/__tests__';
import { DEVICE_WINDOW } from '@src/shared/__tests__/window-layout.fixtures';

import { useOrientationLock } from './use-orientation-lock';

describe('useOrientationLock (Android)', () => {
  it('창이 바뀌어도 결정이 같으면 다시 요청하지 않는다', async () => {
    // Given
    const screenOrientation = createScreenOrientationGatewayStub();
    stubWindowDimensions(DEVICE_WINDOW.phone.width, DEVICE_WINDOW.phone.height);
    const { rerender } = await renderUiHook(() => useOrientationLock(), {
      di: { screenOrientation },
    });

    // When
    stubWindowDimensions(DEVICE_WINDOW.phone.width, DEVICE_WINDOW.phone.height - 48);
    await rerender({});

    // Then
    expect(screenOrientation.lockPortrait).toHaveBeenCalledTimes(1);
    expect(screenOrientation.unlock).not.toHaveBeenCalled();
  });

  it('펼치면 풀고 다시 접으면 세로로 묶는다', async () => {
    // Given
    const screenOrientation = createScreenOrientationGatewayStub();
    stubWindowDimensions(DEVICE_WINDOW.foldedOuter.width, DEVICE_WINDOW.foldedOuter.height);
    const { rerender } = await renderUiHook(() => useOrientationLock(), {
      di: { screenOrientation },
    });

    // When
    stubWindowDimensions(DEVICE_WINDOW.unfoldedInner.width, DEVICE_WINDOW.unfoldedInner.height);
    await rerender({});
    stubWindowDimensions(DEVICE_WINDOW.foldedOuter.width, DEVICE_WINDOW.foldedOuter.height);
    await rerender({});

    // Then
    expect(screenOrientation.lockPortrait).toHaveBeenCalledTimes(2);
    expect(screenOrientation.unlock).toHaveBeenCalledTimes(1);
  });
});
