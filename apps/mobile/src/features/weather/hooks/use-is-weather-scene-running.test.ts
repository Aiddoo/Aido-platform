import { act, renderHook } from '@testing-library/react-native';
import { useIsFocused } from 'expo-router';
import { AccessibilityInfo, AppState, type AppStateStatus } from 'react-native';

import { useIsWeatherSceneRunning } from './use-is-weather-scene-running';

let mockIsReducedMotion = false;

describe('날씨 장면 시계', () => {
  let appStateListener: ((state: AppStateStatus) => void) | undefined;
  const removeSubscription = jest.fn();

  const setAppState = (state: AppStateStatus) => {
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: state });
    appStateListener?.(state);
  };

  beforeEach(() => {
    mockIsReducedMotion = false;
    appStateListener = undefined;
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockImplementation(async () => mockIsReducedMotion);
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      appStateListener = listener;
      return { remove: removeSubscription };
    });
  });

  test('보이는 화면이 앞에 있으면 장면을 움직인다', async () => {
    // Given
    const { result } = await renderHook(() => useIsWeatherSceneRunning());

    // When
    const isAnimating = result.current;

    // Then
    expect(isAnimating).toBe(true);
  });

  test('앱이 백그라운드로 가면 멈추고 돌아오면 다시 움직인다', async () => {
    // Given
    const { result } = await renderHook(() => useIsWeatherSceneRunning());

    // When
    await act(async () => setAppState('background'));
    const whileBackground = result.current;
    await act(async () => setAppState('active'));

    // Then
    expect(whileBackground).toBe(false);
    expect(result.current).toBe(true);
  });

  test('다른 화면으로 이동해 포커스를 잃으면 멈춘다', async () => {
    // Given
    jest.mocked(useIsFocused).mockReturnValue(false);

    // When
    const { result } = await renderHook(() => useIsWeatherSceneRunning());

    // Then
    expect(result.current).toBe(false);
  });

  test('동작 줄이기를 켜면 정지 장면을 보여 준다', async () => {
    // Given
    mockIsReducedMotion = true;

    // When
    const { result } = await renderHook(() => useIsWeatherSceneRunning());

    // Then
    expect(result.current).toBe(false);
  });

  test('화면이 사라지면 앱 상태 구독을 해제한다', async () => {
    // Given
    const { unmount } = await renderHook(() => useIsWeatherSceneRunning());

    // When
    await unmount();

    // Then
    expect(removeSubscription).toHaveBeenCalled();
  });
});
