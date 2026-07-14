import { useErrorReporter } from '@src/bootstrap/providers/di-context';
import { toError } from '@src/shared/errors';
import { useLocalDate } from '@src/shared/providers/local-date-provider';
import { formatDate } from '@src/shared/utils/date';
import { useGlobalSearchParams, useNavigation } from 'expo-router';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

interface FeedDateContextValue {
  selectedDate: Date;
  selectedDateKey: string;
  setSelectedDate: (date: Date) => void;
}

interface FeedDateSelection {
  date: Date;
  /** 이 선택이 이루어진 로컬 날짜. 오늘 key와 달라지면 이전 세션 선택으로 간주한다. */
  selectedOnLocalDateKey: string;
}

const FeedDateContext = createContext<FeedDateContextValue | null>(null);

/** 개인/친구 피드가 공유하는 선택 날짜의 단일 소유자. */
export function FeedDateProvider({ children }: PropsWithChildren) {
  const navigation = useNavigation();
  const { date: routeDate } = useGlobalSearchParams<{ date?: string }>();
  const { currentLocalDate, currentLocalDateKey } = useLocalDate();
  const errorReporter = useErrorReporter();
  const initialRouteNormalizedRef = useRef(false);
  const [selection, setSelection] = useState<FeedDateSelection>(() => ({
    date: currentLocalDate,
    selectedOnLocalDateKey: currentLocalDateKey,
  }));

  const hasDayRolledOver = selection.selectedOnLocalDateKey !== currentLocalDateKey;
  // effect가 route/state를 정리하기 전에도 화면과 query key는 즉시 새 오늘을 사용한다.
  const selectedDate = hasDayRolledOver ? currentLocalDate : selection.date;
  const selectedDateKey = hasDayRolledOver ? currentLocalDateKey : formatDate(selection.date);

  const setRouteDate = useCallback(
    (date: string | undefined) => {
      try {
        navigation.setParams({ date } as never);
      } catch (error) {
        try {
          errorReporter.captureException(toError(error), {
            feature: 'todo',
            method: 'FeedDateProvider.setRouteDate',
          });
        } catch {
          // 라우터와 관측 어댑터 실패가 로컬 날짜 상태까지 중단시키면 안 된다.
        }
      }
    },
    [errorReporter, navigation],
  );

  const recordReset = useCallback(
    (reason: 'initial_route' | 'day_changed', previousDate: string | undefined) => {
      try {
        errorReporter.addBreadcrumb({
          category: 'navigation',
          message: 'feed date reset to today',
          data: { reason, previousDate, nextDate: currentLocalDateKey },
        });
      } catch {
        // 관측 실패는 피드 날짜 전환을 방해하면 안 된다.
      }
    },
    [currentLocalDateKey, errorReporter],
  );

  // 콜드 스타트에서 복원된 과거 route param은 표시 전에 이미 today로 무시하고,
  // navigation state만 커밋 후 정리한다.
  useEffect(() => {
    if (initialRouteNormalizedRef.current) {
      return;
    }
    initialRouteNormalizedRef.current = true;
    if (routeDate === undefined) {
      return;
    }

    setRouteDate(undefined);
    recordReset('initial_route', routeDate);
  }, [recordReset, routeDate, setRouteDate]);

  // 자정 롤오버 후 파생값은 이미 today다. 여기서는 상태/URL을 새 기준으로 정규화한다.
  useEffect(() => {
    if (!hasDayRolledOver) {
      return;
    }

    const previousDate = formatDate(selection.date);
    setSelection({
      date: currentLocalDate,
      selectedOnLocalDateKey: currentLocalDateKey,
    });
    setRouteDate(undefined);
    recordReset('day_changed', previousDate);
  }, [
    currentLocalDate,
    currentLocalDateKey,
    hasDayRolledOver,
    recordReset,
    selection.date,
    setRouteDate,
  ]);

  const setSelectedDate = useCallback(
    (date: Date) => {
      const nextDate = new Date(date);
      const nextDateKey = formatDate(nextDate);
      setSelection({ date: nextDate, selectedOnLocalDateKey: currentLocalDateKey });
      setRouteDate(nextDateKey === currentLocalDateKey ? undefined : nextDateKey);
    },
    [currentLocalDateKey, setRouteDate],
  );

  const value = useMemo<FeedDateContextValue>(
    () => ({ selectedDate, selectedDateKey, setSelectedDate }),
    [selectedDate, selectedDateKey, setSelectedDate],
  );

  return <FeedDateContext.Provider value={value}>{children}</FeedDateContext.Provider>;
}

export function useFeedDateContext(): FeedDateContextValue {
  const context = useContext(FeedDateContext);
  if (context === null) {
    throw new Error('useFeedDate must be used within FeedDateProvider');
  }
  return context;
}
