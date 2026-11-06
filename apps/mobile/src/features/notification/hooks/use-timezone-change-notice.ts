import {
  useAnalytics,
  useDeviceTimezoneService,
  useLogger,
  useTodoService,
} from '@src/bootstrap/providers/di-context';
import { TodoPolicy } from '@src/features/todo/domains/todo.model';
import { track } from '@src/shared/analytics';
import { getErrorMessage } from '@src/shared/errors';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useTranslation } from '@src/shared/i18n';
import { addDaysToDateKey } from '@src/shared/utils/date-key';
import { readDeviceLocalDateState } from '@src/shared/utils/local-date-clock';
import { toHHmm } from '@src/shared/utils/time';
import { useEffect, useEffectEvent } from 'react';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import { type DeviceTimezoneChange, DeviceTimezonePolicy } from '../domains/device-timezone.model';

const UPCOMING_TODO_WINDOW_DAYS = 31;
const UPCOMING_TODO_PAGE_SIZE = 200;

/**
 * 시간대 변경을 서버에 알린 뒤 한 번 안내한다. 보고가 성공해야 재계산이 돌므로 보고 전에는 말하지 않는다.
 * 앞으로 울릴 시간 있는 할 일이 없거나 이름만 바뀌었으면 안내하지 않는다.
 */
export function useTimezoneChangeNotice({
  accountId,
  reportCount,
}: {
  accountId: string | null;
  reportCount: number;
}) {
  const deviceTimezoneService = useDeviceTimezoneService();
  const todoService = useTodoService();
  const analytics = useAnalytics();
  const logger = useLogger();
  const { toast } = useAppToast();
  const { t } = useTranslation('notification');

  const hasUpcomingTimedTodo = async (): Promise<boolean> => {
    const { currentLocalDate, currentLocalDateKey } = readDeviceLocalDateState();
    const result = await todoService.getTodos({
      startDate: currentLocalDateKey,
      endDate: addDaysToDateKey(currentLocalDateKey, UPCOMING_TODO_WINDOW_DAYS),
      size: UPCOMING_TODO_PAGE_SIZE,
    });
    return (
      result.ok &&
      TodoPolicy.hasUpcomingTimedTodo(result.value.todos, {
        dateKey: currentLocalDateKey,
        time: toHHmm(currentLocalDate),
      })
    );
  };

  const announce = useEffectEvent(async (change: DeviceTimezoneChange) => {
    const isNoticeShown =
      DeviceTimezonePolicy.isOffsetChanged(change) &&
      (await hasUpcomingTimedTodo().catch((error: unknown) => {
        logger.warn(NOTIFICATION_LOG_EVENT.TIMEZONE_NOTICE_SKIPPED, {
          error: getErrorMessage(error),
        });
        return false;
      }));
    if (isNoticeShown) {
      toast(t('timezoneChanged.title'), { description: t('timezoneChanged.description') });
    }
    track(analytics, 'device_timezone_changed', {
      offset_bucket: DeviceTimezonePolicy.getTimezoneOffsetBucket(change),
      notice_shown: isNoticeShown,
    });
  });

  useEffect(() => {
    if (accountId == null || reportCount === 0) {
      return;
    }
    const { currentTimeZone, currentUtcOffsetMinutes } = readDeviceLocalDateState();
    const change = deviceTimezoneService.record(accountId, {
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
  }, [accountId, deviceTimezoneService, logger, reportCount]);
}
