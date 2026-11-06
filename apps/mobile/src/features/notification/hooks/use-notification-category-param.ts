import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useCallback } from 'react';

import { notificationParamsSchema } from '../schemas/notification-params.schema';
import type { NotificationCategory } from '../schemas/notification.schema';

/** 알림 URL의 `category` param을 검증해 읽고 바꾼다. */
export function useNotificationCategoryParam() {
  const [{ category }, setParams] = useRouteParams(notificationParamsSchema);
  const setCategory = useCallback(
    (next: NotificationCategory) => setParams({ category: next }),
    [setParams],
  );

  return [category, setCategory] as const;
}
