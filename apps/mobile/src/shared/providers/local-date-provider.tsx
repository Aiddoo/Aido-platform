import { useAnalytics, useErrorReporter } from '@src/bootstrap/providers/di-context';
import { track } from '@src/shared/analytics';
import type { LocalDateChangeTrigger } from '@src/shared/analytics/events/lifecycle.events';
import { toError } from '@src/shared/errors';
import {
  createLocalDateState,
  isSameLocalDateState,
  millisecondsUntilNextLocalMidnight,
  type LocalDateState,
} from '@src/shared/utils/local-date-clock';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

const LocalDateContext = createContext<LocalDateState | null>(null);

function readLocalDateState(): LocalDateState {
  const now = new Date();
  return createLocalDateState(
    now,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    -now.getTimezoneOffset(),
  );
}

/**
 * 앱 전체 로컬 날짜의 단일 소유자.
 *
 * 활성 상태에서는 자정 타이머 하나만 유지하고, background에서는 해제한다.
 * 복귀 시 현재 날짜를 먼저 재확인하므로 JS가 정지된 동안 자정이 지나도 즉시 회복한다.
 */
export function LocalDateProvider({ children }: PropsWithChildren) {
  const analytics = useAnalytics();
  const errorReporter = useErrorReporter();
  const [localDateState, setLocalDateState] = useState(readLocalDateState);
  const currentLocalDateStateRef = useRef(localDateState);

  const recordLocalDateChange = useCallback(
    (previousDate: string, nextDate: string, trigger: LocalDateChangeTrigger) => {
      try {
        errorReporter.addBreadcrumb({
          category: 'lifecycle',
          message: 'local day changed',
          data: { previousDate, nextDate, trigger },
        });
      } catch {
        // 관측 어댑터 실패는 날짜 전환을 방해하면 안 된다.
      }

      try {
        track(analytics, 'local_day_changed', { trigger });
      } catch (error) {
        try {
          errorReporter.captureException(toError(error), {
            feature: 'lifecycle',
            method: 'LocalDateProvider.trackLocalDateChanged',
          });
        } catch {
          // Analytics와 reporter가 함께 실패해도 앱의 날짜 상태는 이미 안전하게 전환됐다.
        }
      }
    },
    [analytics, errorReporter],
  );

  const reconcileCurrentLocalDate = useCallback(
    (trigger: LocalDateChangeTrigger) => {
      const nextLocalDateState = readLocalDateState();
      if (isSameLocalDateState(currentLocalDateStateRef.current, nextLocalDateState)) {
        return;
      }

      const previousState = currentLocalDateStateRef.current;
      currentLocalDateStateRef.current = nextLocalDateState;
      setLocalDateState(nextLocalDateState);
      if (previousState.currentLocalDateKey !== nextLocalDateState.currentLocalDateKey) {
        recordLocalDateChange(
          previousState.currentLocalDateKey,
          nextLocalDateState.currentLocalDateKey,
          trigger,
        );
      } else {
        try {
          errorReporter.addBreadcrumb({
            category: 'lifecycle',
            message: 'local time zone changed',
            data: {
              previousTimeZone: previousState.currentTimeZone,
              nextTimeZone: nextLocalDateState.currentTimeZone,
              utcOffsetMinutes: nextLocalDateState.currentUtcOffsetMinutes,
              trigger,
            },
          });
        } catch {}
      }
    },
    [errorReporter, recordLocalDateChange],
  );

  useEffect(() => {
    let currentAppState = AppState.currentState;
    let localMidnightTimer: ReturnType<typeof setTimeout> | null = null;

    const clearLocalMidnightTimer = () => {
      if (localMidnightTimer !== null) {
        clearTimeout(localMidnightTimer);
        localMidnightTimer = null;
      }
    };

    const scheduleLocalMidnightTimer = () => {
      clearLocalMidnightTimer();
      if (currentAppState !== 'active') {
        return;
      }

      localMidnightTimer = setTimeout(() => {
        reconcileCurrentLocalDate('midnight_timer');
        scheduleLocalMidnightTimer();
      }, millisecondsUntilNextLocalMidnight(new Date()));
    };

    if (currentAppState === 'active') {
      reconcileCurrentLocalDate('foreground');
    }
    scheduleLocalMidnightTimer();
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      currentAppState = nextAppState;
      if (nextAppState === 'active') {
        reconcileCurrentLocalDate('foreground');
        scheduleLocalMidnightTimer();
        return;
      }
      clearLocalMidnightTimer();
    });

    return () => {
      clearLocalMidnightTimer();
      subscription.remove();
    };
  }, [reconcileCurrentLocalDate]);

  return <LocalDateContext.Provider value={localDateState}>{children}</LocalDateContext.Provider>;
}

export function useLocalDate(): LocalDateState {
  const localDateState = useContext(LocalDateContext);
  if (localDateState === null) {
    throw new Error('useLocalDate must be used within LocalDateProvider');
  }
  return localDateState;
}
