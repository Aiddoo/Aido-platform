import { useModerationService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { notifyError, notifySuccess } from '@src/shared/utils/haptics';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import type { BlockTarget } from '../domains/user-block.model';
import { invalidateAfterBlockChange } from './moderation-cache';

export function useBlockUserMutationOptions() {
  const moderationService = useModerationService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const { success, error } = useAppToast();

  return mutationOptions({
    mutationFn: async ({ userId }: BlockTarget) =>
      unwrap(await moderationService.blockUser(userId)),
    onSuccess: (_result, { displayName }) => {
      notifySuccess();
      trackEvent('user_blocked');
      success(t('moderation:block.toast', { name: displayName }));
      return invalidateAfterBlockChange(queryClient);
    },
    onError: (blockError) => {
      notifyError();
      if (isApiError(blockError)) {
        error(blockError.message);
      }
    },
    // 네트워크·서버 장애는 화면 오류 경계가 맡는다
    throwOnError: (blockError) => !isApiError(blockError),
  });
}
