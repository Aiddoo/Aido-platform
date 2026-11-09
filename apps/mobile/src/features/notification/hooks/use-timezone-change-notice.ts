import {
  useDeviceTimezoneService,
  useLogger,
  useTodoService,
} from '@src/bootstrap/providers/di-context';
import { TodoPolicy } from '@src/features/planning/todo/domains/todo.model';
import { useTrack } from '@src/shared/analytics';
import { addDaysToDateKey } from '@src/shared/date/date-key';
import { toHHmm } from '@src/shared/date/instant';
import { readDeviceLocalDateState } from '@src/shared/date/local-date-clock';
import { getErrorMessage } from '@src/shared/errors';
import { useTranslation } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { useEffect, useEffectEvent } from 'react';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import { DeviceTimezonePolicy } from '../domains/device-timezone.model';
import type { DeviceTimezoneChange } from '../domains/device-timezone.model';
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
  const deviceTimezoneService = useDeviceTimezoneService();
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
