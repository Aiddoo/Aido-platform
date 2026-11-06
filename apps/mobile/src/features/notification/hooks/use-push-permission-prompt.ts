import { usePushPromptRepository } from '@src/bootstrap/providers/di-context';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { toInstant } from '@src/shared/date/instant';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useStoredString } from '@src/shared/infra/storage/mmkv-storage';
import { useSuspenseQuery } from '@tanstack/react-query';

import { parsePushPromptDismissedAt, pushPromptStorageKey } from '../apis/push-prompt.repository';
import { PushPermissionPolicy } from '../domains/push-permission.model';

/** 홈 알림 안내를 닫았는지(14일 숨김)를 계정마다 읽고 닫는다 */
export function usePushPermissionPrompt() {
  const pushPromptRepository = usePushPromptRepository();
  const { data: me } = useSuspenseQuery(useGetMeQueryOptions());
  const now = useMinuteNow();
  const [saved] = useStoredString(pushPromptStorageKey(me.id));

  const snooze = () => {
    pushPromptRepository.dismiss(me.id, toInstant(new Date().toISOString()));
  };

  return {
    isSnoozed: PushPermissionPolicy.isPromptSnoozed(
      parsePushPromptDismissedAt(saved),
      toInstant(now.toISOString()),
    ),
    snooze,
  };
}
