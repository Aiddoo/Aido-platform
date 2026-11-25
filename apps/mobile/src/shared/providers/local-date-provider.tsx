import { track } from '@src/shared/analytics';
import type { LocalDateChangeTrigger } from '@src/shared/analytics/event-map';
import {
  getNowInstant,
  isSameLocalDateState,
  type LocalDateState,
  millisecondsUntilNextLocalMidnight,
  readLocalDateState,
} from '@src/shared/date/clock';
import { useAnalytics, useAppLifecycle, useErrorReporter } from '@src/shared/di/shared-di-context';
import { reportUnexpectedError } from '@src/shared/errors';
import { refreshAppTimezone } from '@src/shared/infra/localization/app-timezone';
import {
  type SystemCalendar,
  useSystemCalendar,
} from '@src/shared/infra/localization/device-locale';
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
  /** 앱 시간대를 기기에서 다시 읽어 정한다. 정한 값을 요청 헤더·푸시 기기 보고·위젯이 함께 읽는다 */
  refreshTimezone?: () => string;
}

/**
 * 자정 타이머는 활성 상태에서만 유지하고, 복귀 시 날짜를 먼저 재확인해 JS가 정지된 동안 지난 자정도 즉시 회복한다.
 * 시간대는 복귀·자정·달력 변경 신호마다 새로 읽는다. Android는 시간대만 바꾸면 달력 변경 신호가 오지 않는다
 */
export function LocalDateProvider({
  children,
  useDeviceCalendar = useSystemCalendar,
  refreshTimezone = refreshAppTimezone,
}: LocalDateProviderProps) {
  const analytics = useAnalytics();
  const errorReporter = useErrorReporter();
  const appLifecycle = useAppLifecycle();
  const deviceCalendar = useDeviceCalendar();
  const [localDateState, setLocalDateState] = useState(() =>
    readLocalDateState({ timezone: refreshTimezone() }),
  );
  const currentLocalDateStateRef = useRef(localDateState);
  const { currentTimezone } = localDateState;

  // React Compiler가 훅을 prop 값으로 받는 컴포넌트를 건너뛰므로 손으로 메모한다
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
          reportUnexpectedError(errorReporter, error, 'lifecycle', {
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
      const nextLocalDateState = readLocalDateState({ timezone: refreshTimezone() });
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
            previousTimeZone: previousState.currentTimezone,
            nextTimeZone: nextLocalDateState.currentTimezone,
            utcOffsetMinutes: nextLocalDateState.currentUtcOffsetMinutes,
            trigger,
          },
        });
      }
    },
    [addBreadcrumbSafely, recordLocalDateChange, refreshTimezone],
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
        millisecondsUntilNextLocalMidnight(getNowInstant(), currentTimezone),
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
  }, [appLifecycle, reconcileCurrentLocalDate, currentTimezone]);

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
