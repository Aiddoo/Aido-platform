import { USER_PREFERENCE_DEFAULTS } from '@aido/api/vocabulary';
import { useLogger } from '@src/bootstrap/providers/di-context';
import type { SyncStorage } from '@src/core/ports/sync-storage';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { TodoPolicy, type TodoListResult } from '@src/features/planning/todo/domains/todo.model';
import { useGetUpcomingTodosQueryOptions } from '@src/features/planning/todo/queries/todo.queries';
import { useTrack } from '@src/shared/analytics';
import { readDeviceLocalDateState } from '@src/shared/date/clock';
import type { DateKey } from '@src/shared/date/date-key';
import { formatTimeOfDay } from '@src/shared/date/format/date-format';
import type { TimeOfDay } from '@src/shared/date/time-of-day';
import { toHHmm } from '@src/shared/date/zoned';
import { getErrorMessage } from '@src/shared/errors';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { readStoredValue, writeStoredValue } from '@src/shared/storage/define-stored-value';
import { useStoredValueStorage } from '@src/shared/storage/use-stored-value';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { useQuery } from '@tanstack/react-query';
import { isEqual } from 'es-toolkit';
import { useEffect, useEffectEvent, useState } from 'react';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import { DeviceTimezonePolicy } from '../domains/device-timezone.model';
import type { DeviceTimezone, DeviceTimezoneChange } from '../domains/device-timezone.model';
import { deviceTimezoneStoredValue } from '../schemas/device-timezone-storage.schema';
import { getTimezoneOffsetBucket } from '../utils/device-timezone-analytics';

const EXAMPLE_TODO_TIME: TimeOfDay = { hour: 10, minute: 0 };

/** 보고가 성공해야 서버 재계산이 돌므로 보고 전에는 안내하지 않는다 */
export function useTimezoneChangeNotice({
  accountId,
  reportCount,
}: {
  accountId: string | null;
  reportCount: number;
}) {
  const { trackEvent } = useTrack();
  const logger = useLogger();
  const { toast } = useAppToast();
  const { t } = useTranslation('notification');
  const dateFormatContext = useDateFormatContext();
  // 앱 전체에 걸린 훅이라 요청하지 않고 받아 둔 설정 캐시만 읽는다. 없으면 기본 표기다
  const { data: preference } = useQuery({ ...useGetPreferenceQueryOptions(), enabled: false });

  const [recorded, settleChange] = useRecordedTimezoneChange({ accountId, reportCount });
  const change = recorded?.change ?? null;
  const isOffsetChanged = change != null && DeviceTimezonePolicy.hasOffsetChanged(change);
  const upcomingTimedTodo = useHasUpcomingTimedTodo({
    now: isOffsetChanged ? (recorded?.now ?? null) : null,
  });

  const announce = useEffectEvent((settled: DeviceTimezoneChange, isNoticeShown: boolean) => {
    if (isNoticeShown) {
      const time = formatTimeOfDay(
        EXAMPLE_TODO_TIME,
        preference?.timeFormat ?? USER_PREFERENCE_DEFAULTS.TIME_FORMAT,
        dateFormatContext,
      );
      toast(t('timezoneChanged.title'), {
        description: t('timezoneChanged.description', { time }),
      });
    }
    trackEvent('device_timezone_changed', {
      offset_bucket: getTimezoneOffsetBucket(settled),
      notice_shown: isNoticeShown,
    });
    settleChange();
  });

  // 오프셋이 같으면(이름만 다름) 할 일을 묻지 않고, 다르면 앞으로 시간 있는 할 일이 있을 때만 안내한다
  useEffect(() => {
    if (change == null) {
      return;
    }
    if (!isOffsetChanged) {
      announce(change, false);
      return;
    }
    // 전에 받아 둔 값이 아니라 바뀐 순간 새로 받은 값으로 정한다
    if (upcomingTimedTodo.isFetching) {
      return;
    }
    if (upcomingTimedTodo.isSuccess) {
      announce(change, upcomingTimedTodo.data);
      return;
    }
    if (upcomingTimedTodo.isError) {
      logger.warn(NOTIFICATION_LOG_EVENT.TIMEZONE_NOTICE_SKIPPED, {
        error: getErrorMessage(upcomingTimedTodo.error),
      });
      announce(change, false);
    }
  }, [
    change,
    isOffsetChanged,
    logger,
    upcomingTimedTodo.isFetching,
    upcomingTimedTodo.isSuccess,
    upcomingTimedTodo.isError,
    upcomingTimedTodo.data,
    upcomingTimedTodo.error,
  ]);
}

/** 바뀐 순간의 기기 날짜·벽시계. 할 일을 묻는 범위와 "앞으로"의 기준이다 */
interface DeviceNow {
  dateKey: DateKey;
  time: string;
  timeZone: string;
}

interface RecordedTimezoneChange {
  change: DeviceTimezoneChange;
  now: DeviceNow;
}

/** 보고할 때마다 기기 시간대를 남기고, 이 계정이 남긴 값과 달라졌으면 안내가 끝날 때까지 그 변화를 쥔다 */
function useRecordedTimezoneChange({
  accountId,
  reportCount,
}: {
  accountId: string | null;
  reportCount: number;
}) {
  const storage = useStoredValueStorage(deviceTimezoneStoredValue);
  const [recorded, setRecorded] = useState<RecordedTimezoneChange | null>(null);

  useEffect(() => {
    if (accountId == null || reportCount === 0) {
      return;
    }
    const { currentLocalDate, currentLocalDateKey, currentTimeZone, currentUtcOffsetMinutes } =
      readDeviceLocalDateState();
    const change = recordDeviceTimezone(storage, accountId, {
      timeZone: currentTimeZone,
      offsetMinutes: currentUtcOffsetMinutes,
    });
    if (change != null) {
      // oxlint-disable-next-line react/set-state-in-effect -- 기기 저장소에 남긴 결과라 렌더 중에 계산할 수 없다
      setRecorded({
        change,
        now: {
          dateKey: currentLocalDateKey,
          time: toHHmm(currentLocalDate, currentTimeZone),
          timeZone: currentTimeZone,
        },
      });
    }
  }, [accountId, storage, reportCount]);

  return [recorded, () => setRecorded(null)] as const;
}

/** 그 시각 뒤로 끝나지 않은 시간 있는 할 일이 있는가. 기준 시각이 있을 때만 묻는다 */
function useHasUpcomingTimedTodo({ now }: { now: DeviceNow | null }) {
  const todayKey = useTodayKey();
  return useQuery({
    ...useGetUpcomingTodosQueryOptions({ todayKey: now?.dateKey ?? todayKey }),
    enabled: now != null,
    select: ({ todos }: TodoListResult) =>
      now != null && TodoPolicy.hasUpcomingTimedTodo(todos, now),
  });
}

/** 지금 값을 남기고, 이 계정이 남긴 시간대와 다르면 바뀐 내용을 돌려준다. 처음 남길 때는 없다 */
function recordDeviceTimezone(
  storage: SyncStorage,
  accountId: string,
  current: DeviceTimezone,
): DeviceTimezoneChange | null {
  const recorded = readStoredValue(storage, deviceTimezoneStoredValue);
  const previous = recorded?.userId === accountId ? recorded.deviceTimezone : null;
  if (previous == null || !isEqual(previous, current)) {
    writeStoredValue(storage, deviceTimezoneStoredValue, {
      userId: accountId,
      deviceTimezone: current,
    });
  }
  if (previous == null || !DeviceTimezonePolicy.hasDeviceTimezoneChanged(previous, current)) {
    return null;
  }
  return { previous, current };
}
