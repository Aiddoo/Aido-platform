import { usePushPromptService } from '@src/bootstrap/providers/di-context';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

/** 홈 알림 안내를 닫았는지(14일 숨김)를 계정마다 읽고 닫는다 */
export function usePushPermissionPrompt() {
  const pushPromptService = usePushPromptService();
  const { data: me } = useSuspenseQuery(useGetMeQueryOptions());

  const isSnoozed = useSyncExternalStore(
    (listener) => pushPromptService.subscribe(me.id, listener),
    () => pushPromptService.isSnoozed(me.id, new Date()),
  );

  const snooze = () => {
    pushPromptService.snooze(me.id, new Date());
  };

  return { isSnoozed, snooze };
}
