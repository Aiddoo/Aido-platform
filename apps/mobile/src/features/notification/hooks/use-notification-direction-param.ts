import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useCallback } from 'react';

import {
  type NotificationDirection,
  notificationParamsSchema,
} from '../schemas/notification-params.schema';

/** 알림 URL의 `direction` param(받은 알림·보낸 콕)을 검증해 읽고 바꾼다. */
export function useNotificationDirectionParam() {
  const [{ direction }, setParams] = useRouteParams(notificationParamsSchema);
  const setDirection = useCallback(
    (next: NotificationDirection) => setParams({ direction: next }),
    [setParams],
  );

  return [direction, setDirection] as const;
}
