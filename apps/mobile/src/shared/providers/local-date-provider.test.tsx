import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import { createMockAnalytics, createMockDIContainer } from '@src/shared/__tests__';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  LocalDateProvider,
  millisecondsUntilNextLocalMidnight,
  useLocalDate,
} from './local-date-provider';

const originalCurrentStateDescriptor = Object.getOwnPropertyDescriptor(AppState, 'currentState');

function createMockErrorReporter(): jest.Mocked<ErrorReporter> {
  return {
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
    setUserId: jest.fn(),
  };
}

describe('LocalDateProvider', () => {
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

  function setup() {
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
    const hook = renderHook(() => useLocalDate(), { wrapper });

    return {
      ...hook,
      analytics,
      errorReporter,
      remove,
      getAppStateListener: () => appStateListener,
    };
  }

  it('앱이 활성 상태인 채 자정을 지나면 새 로컬 날짜를 즉시 제공한다', () => {
    jest.setSystemTime(new Date(2026, 6, 14, 23, 59, 59, 900));
    const { result, analytics, errorReporter } = setup();
    expect(result.current.currentLocalDateKey).toBe('2026-07-14');

    act(() => {
      jest.advanceTimersByTime(200);
    });

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

  it('백그라운드에서 날짜가 바뀐 뒤 foreground 복귀 시 즉시 보정한다', () => {
    jest.setSystemTime(new Date(2026, 6, 14, 12));
    const { result, analytics, getAppStateListener } = setup();

    act(() => {
      getAppStateListener()?.('background');
      jest.setSystemTime(new Date(2026, 6, 15, 0, 0, 1));
      getAppStateListener()?.('active');
    });

    expect(result.current.currentLocalDateKey).toBe('2026-07-15');
    expect(analytics.trackEvent).toHaveBeenCalledWith('local_day_changed', {
      trigger: 'foreground',
    });
  });

  it('관측 어댑터 실패가 날짜 변경을 중단시키지 않는다', () => {
    jest.setSystemTime(new Date(2026, 6, 14, 23, 59, 59, 900));
    const { result, analytics, errorReporter } = setup();
    analytics.trackEvent.mockImplementation(() => {
      throw new Error('analytics unavailable');
    });
    errorReporter.captureException.mockImplementation(() => {
      throw new Error('reporter unavailable');
    });

    expect(() => {
      act(() => {
        jest.advanceTimersByTime(200);
      });
    }).not.toThrow();

    expect(result.current.currentLocalDateKey).toBe('2026-07-15');
    expect(errorReporter.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'analytics unavailable' }),
      expect.objectContaining({ method: 'LocalDateProvider.trackLocalDateChanged' }),
    );
  });

  it('언마운트 시 AppState 구독과 자정 타이머를 모두 정리한다', () => {
    jest.setSystemTime(new Date(2026, 6, 14, 12));
    const { unmount, remove } = setup();
    expect(jest.getTimerCount()).toBe(1);

    unmount();

    expect(remove).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('millisecondsUntilNextLocalMidnight', () => {
  it('다음 로컬 자정 직후까지 한 번만 예약한다', () => {
    expect(millisecondsUntilNextLocalMidnight(new Date(2026, 6, 14, 23, 59, 59, 900))).toBe(200);
  });
});
