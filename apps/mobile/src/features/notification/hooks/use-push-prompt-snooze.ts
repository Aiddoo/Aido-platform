import { usePushPromptRepository } from '@src/bootstrap/providers/di-context';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { getNowInstant } from '@src/shared/date/instant';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';

import { PushPermissionPolicy } from '../domains/push-permission.model';

export function usePushPromptSnooze() {
  const pushPromptRepository = usePushPromptRepository();
  const { data: me } = useSuspenseQuery(useGetMeQueryOptions());
  const now = useMinuteNow();
  const dismissedAt = useSyncExternalStore(
    useCallback(
      (onChange: () => void) => pushPromptRepository.subscribe(me.id, onChange),
      [pushPromptRepository, me.id],
    ),
    () => pushPromptRepository.findDismissedAt(me.id),
  );

  const snooze = () => {
    pushPromptRepository.dismiss(me.id, getNowInstant());
  };

  const isSnoozed = PushPermissionPolicy.isPromptSnoozed(dismissedAt, now);

  return [isSnoozed, snooze] as const;
}
