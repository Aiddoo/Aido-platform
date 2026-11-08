import { usePushPermissionPromptRepository } from '@src/bootstrap/providers/di-context';
import { getNowInstant } from '@src/shared/date/instant';
import { noop } from 'es-toolkit';
import { useCallback, useSyncExternalStore } from 'react';

import { EMPTY_PUSH_PERMISSION_PROMPT } from '../constants/notification.constants';

/** 계정을 아직 모르면 답한 적 없는 것으로 읽고 쓰지 않는다 */
export function usePushPermissionPrompt(userId: string | undefined) {
  const repository = usePushPermissionPromptRepository();
  const subscribe = useCallback(
    (onChange: () => void) => (userId == null ? noop : repository.subscribe(userId, onChange)),
    [repository, userId],
  );
  const prompt = useSyncExternalStore(subscribe, () =>
    userId == null ? EMPTY_PUSH_PERMISSION_PROMPT : repository.find(userId),
  );

  const defer = () => {
    if (userId != null) {
      repository.defer(userId, getNowInstant());
    }
  };

  const dismissNotice = () => {
    if (userId != null) {
      repository.dismissNotice(userId, getNowInstant());
    }
  };

  return [prompt, { defer, dismissNotice }] as const;
}
