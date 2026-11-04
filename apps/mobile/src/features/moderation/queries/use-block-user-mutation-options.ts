import { useHaptics, useModerationService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import type { BlockTarget } from '../domains/user-block.model';
import { invalidateAfterBlockChange } from './moderation-cache';

export function useBlockUserMutationOptions() {
  const haptics = useHaptics();
  const moderationService = useModerationService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const { success, error } = useAppToast();

  return mutationOptions({
    mutationFn: async ({ userId }: BlockTarget) =>
      unwrap(await moderationService.blockUser(userId)),
    onSuccess: (_result, { displayName }) => {
      haptics.notify('success');
      trackEvent('user_blocked');
      success(t('moderation:block.toast', { name: displayName }));
      return invalidateAfterBlockChange(queryClient);
    },
    onError: (blockError) => {
      haptics.notify('error');
      if (isApiError(blockError)) {
        error(blockError.message);
      }
    },
    // 네트워크·서버 장애는 화면 오류 경계가 맡는다
    throwOnError: (blockError) => !isApiError(blockError),
  });
}
