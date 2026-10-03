import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import { createMockAnalytics, createMockDIContainer } from '@src/shared/__tests__';
import { millisecondsUntilNextLocalMidnight } from '@src/shared/utils/local-date-clock';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { LocalDateProvider, useLocalDate } from './local-date-provider';

const originalCurrentStateDescriptor = Object.getOwnPropertyDescriptor(AppState, 'currentState');

function createMockErrorReporter(): jest.Mocked<ErrorReporter> {
  return {
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
    setUserId: jest.fn(),
  };
}

describe('앱 로컬 날짜 Provider', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      writable: true,
      value: 'active',
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    if (originalCurrentStateDescriptor) {
      Object.defineProperty(AppState, 'currentState', originalCurrentStateDescriptor);
    }
  });

  async function setup() {
    const analytics = createMockAnalytics();
    const errorReporter = createMockErrorReporter();
    const remove = jest.fn();
    let appStateListener: ((state: AppStateStatus) => void) | undefined;

    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      appStateListener = listener;
      return { remove };
    });

    const wrapper = ({ children }: PropsWithChildren) => (
      <StaticDIProvider container={createMockDIContainer({ analytics, errorReporter })}>
        <LocalDateProvider>{children}</LocalDateProvider>
      </StaticDIProvider>
    );
    const hook = await renderHook(() => useLocalDate(), { wrapper });

    return {
      ...hook,
      analytics,
      errorReporter,
      remove,
      getAppStateListener: () => appStateListener,
    };
  }

  it('앱이 활성 상태인 채 자정을 지나면 새 로컬 날짜를 즉시 제공한다', async () => {
    // Given
    jest.setSystemTime(new Date(2026, 6, 14, 23, 59, 59, 900));
    const { result, analytics, errorReporter } = await setup();
    expect(result.current.currentLocalDateKey).toBe('2026-07-14');

    // When
    await act(() => {
      jest.advanceTimersByTime(200);
    });

    // Then
    expect(result.current.currentLocalDateKey).toBe('2026-07-15');
    expect(analytics.trackEvent).toHaveBeenCalledWith('local_day_changed', {
      trigger: 'midnight_timer',
    });
    expect(errorReporter.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'lifecycle',
        data: expect.objectContaining({
          previousDate: '2026-07-14',
          nextDate: '2026-07-15',
        }),
      }),
    );
  });

  it('백그라운드에서 날짜가 바뀐 뒤 foreground 복귀 시 즉시 보정한다', async () => {
    // Given
    jest.setSystemTime(new Date(2026, 6, 14, 12));
    const { result, analytics, getAppStateListener } = await setup();

    // When
    await act(() => {
      getAppStateListener()?.('background');
      jest.setSystemTime(new Date(2026, 6, 15, 0, 0, 1));
      getAppStateListener()?.('active');
    });

    // Then
    expect(result.current.currentLocalDateKey).toBe('2026-07-15');
    expect(analytics.trackEvent).toHaveBeenCalledWith('local_day_changed', {
      trigger: 'foreground',
    });
  });

  it('날짜가 같아도 복귀할 때 시간대가 바뀌면 현재 상태를 갱신한다', async () => {
    // Given
    jest.setSystemTime(new Date('2026-07-14T00:00:00.000Z'));
    const options = Intl.DateTimeFormat().resolvedOptions();
    const timeZone = jest
      .spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions')
      .mockReturnValue({ ...options, timeZone: 'Asia/Seoul' });
    const { result, analytics, getAppStateListener, unmount } = await setup();
    const previousDate = result.current.currentLocalDate;
    // When
    await act(() => {
      getAppStateListener()?.('background');
      timeZone.mockReturnValue({ ...options, timeZone: 'Asia/Tokyo' });
      getAppStateListener()?.('active');
    });
    // Then
    expect(result.current.currentLocalDateKey).toBe('2026-07-14');
    expect(result.current.currentTimeZone).toBe('Asia/Tokyo');
    expect(result.current.currentLocalDate).not.toBe(previousDate);
    expect(analytics.trackEvent).not.toHaveBeenCalled();
    await unmount();
    timeZone.mockRestore();
  });

  it('관측 어댑터 실패가 날짜 변경을 중단시키지 않는다', async () => {
    // Given
    jest.setSystemTime(new Date(2026, 6, 14, 23, 59, 59, 900));
    const { result, analytics, errorReporter } = await setup();
    analytics.trackEvent.mockImplementation(() => {
      throw new Error('analytics unavailable');
    });
    errorReporter.captureException.mockImplementation(() => {
      throw new Error('reporter unavailable');
    });

    // When
    await act(() => {
      jest.advanceTimersByTime(200);
    });

    // Then
    expect(result.current.currentLocalDateKey).toBe('2026-07-15');
    expect(errorReporter.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'analytics unavailable' }),
      expect.objectContaining({ method: 'LocalDateProvider.trackLocalDateChanged' }),
    );
  });

  it('언마운트 시 AppState 구독과 자정 타이머를 모두 정리한다', async () => {
    // Given
    jest.setSystemTime(new Date(2026, 6, 14, 23, 59, 59, 900));
    const { unmount, remove, analytics } = await setup();

    // When
    await unmount();
    await act(() => {
      jest.advanceTimersByTime(200);
    });
    // Then
    expect(remove).toHaveBeenCalledTimes(1);
    expect(analytics.trackEvent).not.toHaveBeenCalled();
  });
});

describe('다음 로컬 자정 예약', () => {
  it('다음 로컬 자정 직후까지 한 번만 예약한다', () => {
    // Given
    const now = new Date(2026, 6, 14, 23, 59, 59, 900);
    // When
    const delay = millisecondsUntilNextLocalMidnight(now);
    // Then
    expect(delay).toBe(200);
  });
});
