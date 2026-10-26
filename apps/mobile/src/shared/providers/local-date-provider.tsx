import { useAnalytics, useErrorReporter } from '@src/bootstrap/providers/di-context';
import { track } from '@src/shared/analytics';
import { toError } from '@src/shared/errors';
import type { LocalDateChangeTrigger } from '@src/shared/observability/telemetry-keys';
import {
  createLocalDateState,
  isSameLocalDateState,
  millisecondsUntilNextLocalMidnight,
  type LocalDateState,
} from '@src/shared/utils/local-date-clock';
import { type Calendar, useCalendars } from 'expo-localization';
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

type DeviceCalendar = Pick<Calendar, 'timeZone'>;

const FALLBACK_TIME_ZONE = 'UTC';

function useExpoDeviceCalendar(): DeviceCalendar {
  const [calendar] = useCalendars();
  return calendar;
}

function readLocalDateState(timeZone: string): LocalDateState {
  const now = new Date();
  return createLocalDateState(now, timeZone, -now.getTimezoneOffset());
}

interface LocalDateProviderProps extends PropsWithChildren {
  /** 기기 달력. 시간대·달력 설정이 바뀔 때마다 새 객체를 돌려준다. */
  useDeviceCalendar?: () => DeviceCalendar;
}

/**
 * 앱 전체 로컬 날짜의 단일 소유자.
 *
 * 활성 상태에서는 기기 시간대 기준 자정 타이머 하나만 유지하고, background에서는 해제한다.
 * 복귀 시 현재 날짜를 먼저 재확인하므로 JS가 정지된 동안 자정이 지나도 즉시 회복한다.
 * 실행 중 시간대·달력 설정이 바뀌면(iOS significant time change 포함) 기기 달력이 새 객체로
 * 바뀌고, 날짜를 재평가한 뒤 새 시간대의 자정으로 타이머를 다시 예약한다.
 */
export function LocalDateProvider({
  children,
  useDeviceCalendar = useExpoDeviceCalendar,
}: LocalDateProviderProps) {
  const analytics = useAnalytics();
  const errorReporter = useErrorReporter();
  const deviceCalendar = useDeviceCalendar();
  const deviceTimeZone = deviceCalendar.timeZone ?? FALLBACK_TIME_ZONE;
  const deviceTimeZoneRef = useRef(deviceTimeZone);
  const [localDateState, setLocalDateState] = useState(() => readLocalDateState(deviceTimeZone));
  const currentLocalDateStateRef = useRef(localDateState);
  const { currentTimeZone } = localDateState;

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
      const nextLocalDateState = readLocalDateState(deviceTimeZoneRef.current);
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
        millisecondsUntilNextLocalMidnight(new Date(), currentTimeZone),
      );
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
  }, [reconcileCurrentLocalDate, currentTimeZone]);

  // 첫 렌더의 재평가는 같은 상태라 무시된다.
  useEffect(() => {
    deviceTimeZoneRef.current = deviceTimeZone;
    if (AppState.currentState === 'active') {
      reconcileCurrentLocalDate('calendar_change');
    }
  }, [deviceCalendar, deviceTimeZone, reconcileCurrentLocalDate]);

  return <LocalDateContext.Provider value={localDateState}>{children}</LocalDateContext.Provider>;
}

export function useLocalDate(): LocalDateState {
  const localDateState = useContext(LocalDateContext);
  if (localDateState == null) {
    throw new Error('useLocalDate must be used within LocalDateProvider');
  }
  return localDateState;
}
