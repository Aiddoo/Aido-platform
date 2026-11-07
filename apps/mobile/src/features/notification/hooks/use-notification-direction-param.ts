import { nudgeDirectionSchema } from '@src/features/social/nudge/schemas/nudge-interaction.schema';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useCallback } from 'react';

import { notificationParamsSchema } from '../schemas/notification-params.schema';

/** 알림 URL의 `direction` param(받은 알림·보낸 콕)을 검증해 읽고 바꾼다. */
export function useNotificationDirectionParam() {
  const [{ direction }, setParams] = useRouteParams(notificationParamsSchema);
  const setDirection = useCallback(
    (value: string) => {
      const parsed = nudgeDirectionSchema.safeParse(value);
      if (parsed.success) {
        setParams({ direction: parsed.data });
      }
    },
    [setParams],
  );

  return [direction, setDirection] as const;
}
