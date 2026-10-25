import { nudgeDirectionSchema } from '@src/features/nudge/domains/nudge-interaction.model';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { z } from 'zod';

const notificationDirectionSearchSchema = z.object({
  direction: nudgeDirectionSchema.catch('received'),
});

type NotificationDirection = z.output<typeof notificationDirectionSearchSchema>['direction'];

/** 알림 URL의 `direction` param(받은 알림·보낸 콕)을 검증해 읽고 바꾼다. */
export function useNotificationDirectionParam(): readonly [
  NotificationDirection,
  (direction: NotificationDirection) => void,
] {
  const { direction } = notificationDirectionSearchSchema.parse(useLocalSearchParams());
  const setDirection = useCallback(
    (value: NotificationDirection) => router.setParams({ direction: value }),
    [],
  );

  return [direction, setDirection] as const;
}
