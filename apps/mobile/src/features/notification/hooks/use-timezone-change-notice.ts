import { useLogger, useTodoService } from '@src/bootstrap/providers/di-context';
import type { SyncStorage } from '@src/core/ports/sync-storage';
import { TodoPolicy } from '@src/features/planning/todo/domains/todo.model';
import { useTrack } from '@src/shared/analytics';
import { addDaysToDateKey } from '@src/shared/date/date-key';
import { toHHmm } from '@src/shared/date/instant';
import { readDeviceLocalDateState } from '@src/shared/date/local-date-clock';
import { getErrorMessage } from '@src/shared/errors';
import { useTranslation } from '@src/shared/i18n';
import { readStoredValue, writeStoredValue } from '@src/shared/storage/define-stored-value';
import { useStoredValueStorage } from '@src/shared/storage/use-stored-value';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { isEqual } from 'es-toolkit';
import { useEffect, useEffectEvent } from 'react';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import { DeviceTimezonePolicy } from '../domains/device-timezone.model';
import type { DeviceTimezone, DeviceTimezoneChange } from '../domains/device-timezone.model';
import { deviceTimezoneStoredValue } from '../schemas/device-timezone-storage.schema';
import { getTimezoneOffsetBucket } from '../utils/notification-analytics';

const UPCOMING_TODO_WINDOW_DAYS = 31;
const UPCOMING_TODO_PAGE_SIZE = 200;

/** 보고가 성공해야 서버 재계산이 돌므로 보고 전에는 안내하지 않는다 */
export function useTimezoneChangeNotice({
  accountId,
  reportCount,
}: {
  accountId: string | null;
  reportCount: number;
}) {
  const storage = useStoredValueStorage(deviceTimezoneStoredValue);
  const todoService = useTodoService();
  const { trackEvent } = useTrack();
  const logger = useLogger();
  const { toast } = useAppToast();
  const { t } = useTranslation('notification');

  const getHasUpcomingTimedTodo = async (): Promise<boolean> => {
    const { currentLocalDate, currentLocalDateKey, currentTimeZone } = readDeviceLocalDateState();
    const result = await todoService.getTodos({
      startDate: currentLocalDateKey,
      endDate: addDaysToDateKey(currentLocalDateKey, UPCOMING_TODO_WINDOW_DAYS),
      size: UPCOMING_TODO_PAGE_SIZE,
    });
    return (
      result.ok &&
      TodoPolicy.hasUpcomingTimedTodo(result.value.todos, {
        dateKey: currentLocalDateKey,
        time: toHHmm(currentLocalDate, currentTimeZone),
        timeZone: currentTimeZone,
      })
    );
  };

  const announce = useEffectEvent(async (change: DeviceTimezoneChange) => {
    const isNoticeShown =
      DeviceTimezonePolicy.hasOffsetChanged(change) &&
      (await getHasUpcomingTimedTodo().catch((error: unknown) => {
        logger.warn(NOTIFICATION_LOG_EVENT.TIMEZONE_NOTICE_SKIPPED, {
          error: getErrorMessage(error),
        });
        return false;
      }));
    if (isNoticeShown) {
      toast(t('timezoneChanged.title'), { description: t('timezoneChanged.description') });
    }
    trackEvent('device_timezone_changed', {
      offset_bucket: getTimezoneOffsetBucket(change),
      notice_shown: isNoticeShown,
    });
  });

  useEffect(() => {
    if (accountId == null || reportCount === 0) {
      return;
    }
    const { currentTimeZone, currentUtcOffsetMinutes } = readDeviceLocalDateState();
    const change = recordDeviceTimezone(storage, accountId, {
      timeZone: currentTimeZone,
      offsetMinutes: currentUtcOffsetMinutes,
    });
    if (change != null) {
      announce(change).catch((error: unknown) =>
        logger.warn(NOTIFICATION_LOG_EVENT.TIMEZONE_NOTICE_SKIPPED, {
          error: getErrorMessage(error),
        }),
      );
    }
  }, [accountId, storage, logger, reportCount]);
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
