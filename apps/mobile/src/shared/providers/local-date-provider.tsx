import { useAnalytics, useErrorReporter } from '@src/bootstrap/providers/di-context';
import { track } from '@src/shared/analytics';
import type { LocalDateChangeTrigger } from '@src/shared/analytics/events/lifecycle.events';
import { toError } from '@src/shared/errors';
import { formatDate } from '@src/shared/utils/date';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';

const MIDNIGHT_GRACE_MS = 100;

interface LocalDateState {
  currentLocalDate: Date;
  currentLocalDateKey: string;
}

const LocalDateContext = createContext<LocalDateState | null>(null);

function createLocalDateState(now: Date): LocalDateState {
  return { currentLocalDate: now, currentLocalDateKey: formatDate(now) };
}

/** 로컬 자정 직전의 타이머 조기 실행을 피하도록 작은 grace를 더한다. */
export function millisecondsUntilNextLocalMidnight(now: Date): number {
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  return Math.max(MIDNIGHT_GRACE_MS, nextMidnight.getTime() - now.getTime() + MIDNIGHT_GRACE_MS);
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
  const initialLocalDateStateRef = useRef<LocalDateState | null>(null);
  if (initialLocalDateStateRef.current === null) {
    initialLocalDateStateRef.current = createLocalDateState(new Date());
  }

  const [localDateState, setLocalDateState] = useState<LocalDateState>(
    initialLocalDateStateRef.current,
  );
  const currentLocalDateKeyRef = useRef(localDateState.currentLocalDateKey);

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
      const nextLocalDateState = createLocalDateState(new Date());
      if (nextLocalDateState.currentLocalDateKey === currentLocalDateKeyRef.current) {
        return;
      }

      const previousLocalDateKey = currentLocalDateKeyRef.current;
      currentLocalDateKeyRef.current = nextLocalDateState.currentLocalDateKey;
      setLocalDateState(nextLocalDateState);
      recordLocalDateChange(previousLocalDateKey, nextLocalDateState.currentLocalDateKey, trigger);
    },
    [recordLocalDateChange],
  );

  useEffect(() => {
    let currentAppState: AppStateStatus = AppState.currentState;
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
