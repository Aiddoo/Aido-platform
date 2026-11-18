import { track } from '@src/shared/analytics';
import type { LocalDateChangeTrigger } from '@src/shared/analytics/event-map';
import {
  createLocalDateState,
  getNowInstant,
  isSameLocalDateState,
  millisecondsUntilNextLocalMidnight,
  type LocalDateState,
} from '@src/shared/date/clock';
import { useAnalytics, useAppLifecycle, useErrorReporter } from '@src/shared/di/shared-di-context';
import { toError } from '@src/shared/errors';
import {
  type SystemCalendar,
  useSystemCalendar,
} from '@src/shared/infra/localization/device-locale';
import { getDeviceTimezone } from '@src/shared/infra/localization/device-timezone';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  use,
  useEffect,
  useRef,
  useState,
} from 'react';

const LocalDateContext = createContext<LocalDateState | null>(null);

interface LocalDateProviderProps extends PropsWithChildren {
  /** 기기 달력. 시간대·달력 설정이 바뀌었다고 OS가 알릴 때마다 새 객체를 돌려준다. 다시 읽을 신호로만 쓴다 */
  useDeviceCalendar?: () => SystemCalendar;
  /** 지금 기기 시간대. 요청 헤더·위젯과 같은 값을 다시 읽을 때마다 새로 읽는다 */
  readDeviceTimeZone?: () => string;
}

/**
 * 자정 타이머는 활성 상태에서만 유지하고, 복귀 시 날짜를 먼저 재확인해 JS가 정지된 동안 지난 자정도 즉시 회복한다.
 * 시간대는 복귀·자정·달력 변경 신호마다 새로 읽는다. Android는 시간대만 바꾸면 달력 변경 신호가 오지 않는다
 */
export function LocalDateProvider({
  children,
  useDeviceCalendar = useSystemCalendar,
  readDeviceTimeZone = getDeviceTimezone,
}: LocalDateProviderProps) {
  const analytics = useAnalytics();
  const errorReporter = useErrorReporter();
  const appLifecycle = useAppLifecycle();
  const deviceCalendar = useDeviceCalendar();
  const [localDateState, setLocalDateState] = useState(() =>
    createLocalDateState(getNowInstant(), readDeviceTimeZone()),
  );
  const currentLocalDateStateRef = useRef(localDateState);
  const { currentTimeZone } = localDateState;

  const addBreadcrumbSafely = useCallback(
    (breadcrumb: Parameters<typeof errorReporter.addBreadcrumb>[0]) => {
      try {
        errorReporter.addBreadcrumb(breadcrumb);
      } catch {
        // 관측 어댑터 실패는 날짜·시간대 전환을 방해하면 안 된다.
      }
    },
    [errorReporter],
  );

  const recordLocalDateChange = useCallback(
    (previousDate: string, nextDate: string, trigger: LocalDateChangeTrigger) => {
      addBreadcrumbSafely({
        category: 'lifecycle',
        message: 'local day changed',
        data: { previousDate, nextDate, trigger },
      });

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
    [addBreadcrumbSafely, analytics, errorReporter],
  );

  const reconcileCurrentLocalDate = useCallback(
    (trigger: LocalDateChangeTrigger) => {
      const nextLocalDateState = createLocalDateState(getNowInstant(), readDeviceTimeZone());
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
        addBreadcrumbSafely({
          category: 'lifecycle',
          message: 'local time zone changed',
          data: {
            previousTimeZone: previousState.currentTimeZone,
            nextTimeZone: nextLocalDateState.currentTimeZone,
            utcOffsetMinutes: nextLocalDateState.currentUtcOffsetMinutes,
            trigger,
          },
        });
      }
    },
    [addBreadcrumbSafely, readDeviceTimeZone, recordLocalDateChange],
  );

  useEffect(() => {
    let currentAppState = appLifecycle.getCurrentState();
    let localMidnightTimer: ReturnType<typeof setTimeout> | null = null;

    const clearLocalMidnightTimer = () => {
      if (localMidnightTimer != null) {
        clearTimeout(localMidnightTimer);
        localMidnightTimer = null;
      }
    };

    const scheduleLocalMidnightTimer = () => {
      clearLocalMidnightTimer();
      if (currentAppState !== 'active') {
        return;
      }

      localMidnightTimer = setTimeout(
        () => {
          reconcileCurrentLocalDate('midnight_timer');
          scheduleLocalMidnightTimer();
        },
        millisecondsUntilNextLocalMidnight(getNowInstant(), currentTimeZone),
      );
    };

    if (currentAppState === 'active') {
      reconcileCurrentLocalDate('foreground');
    }
    scheduleLocalMidnightTimer();
    const unsubscribe = appLifecycle.subscribe((nextAppState) => {
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
      unsubscribe();
    };
  }, [appLifecycle, reconcileCurrentLocalDate, currentTimeZone]);

  // 첫 렌더의 재평가는 같은 상태라 무시된다.
  useEffect(() => {
    if (appLifecycle.getCurrentState() === 'active') {
      reconcileCurrentLocalDate('calendar_change');
    }
  }, [appLifecycle, deviceCalendar, reconcileCurrentLocalDate]);

  return <LocalDateContext value={localDateState}>{children}</LocalDateContext>;
}

export function useLocalDate(): LocalDateState {
  const localDateState = use(LocalDateContext);
  if (localDateState == null) {
    throw new Error('useLocalDate must be used within LocalDateProvider');
  }
  return localDateState;
}
