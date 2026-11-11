import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { createAppLifecycleGatewayStub, createTestDi } from '@src/shared/__tests__';
import { act, renderHook } from '@testing-library/react-native';
import { useIsFocused } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { AccessibilityInfo } from 'react-native';

import { useIsAnimationActive } from './use-is-animation-active';

let mockIsReducedMotion = false;

describe('공용 애니메이션 멈춤 조건', () => {
  let appLifecycle = createAppLifecycleGatewayStub();

  function wrapper({ children }: PropsWithChildren) {
    return (
      <StaticDIProvider container={createTestDi({ appLifecycle })}>{children}</StaticDIProvider>
    );
  }

  function renderActiveHook() {
    return renderHook(() => useIsAnimationActive(), { wrapper });
  }

  beforeEach(() => {
    mockIsReducedMotion = false;
    appLifecycle = createAppLifecycleGatewayStub();
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockImplementation(async () => mockIsReducedMotion);
  });

  it('보이는 화면이 앞에 있으면 움직인다', async () => {
    // Given
    const { result } = await renderActiveHook();

    // When
    const isAnimating = result.current;

    // Then
    expect(isAnimating).toBe(true);
  });

  it('앱이 백그라운드로 가면 멈추고 돌아오면 다시 움직인다', async () => {
    // Given
    const { result } = await renderActiveHook();

    // When
    await act(async () => appLifecycle.emit('background'));
    const whileBackground = result.current;
    await act(async () => appLifecycle.emit('active'));

    // Then
    expect(whileBackground).toBe(false);
    expect(result.current).toBe(true);
  });

  it('다른 화면으로 이동해 포커스를 잃으면 멈춘다', async () => {
    // Given
    jest.mocked(useIsFocused).mockReturnValue(false);

    // When
    const { result } = await renderActiveHook();

    // Then
    expect(result.current).toBe(false);
  });

  it('동작 줄이기를 켜면 멈춘다', async () => {
    // Given
    mockIsReducedMotion = true;

    // When
    const { result } = await renderActiveHook();

    // Then
    expect(result.current).toBe(false);
  });

  it('화면이 사라지면 앱 상태 구독을 해제한다', async () => {
    // Given
    const { unmount } = await renderActiveHook();

    // When
    await unmount();

    // Then
    expect(appLifecycle.getListenerCount()).toBe(0);
  });
});
