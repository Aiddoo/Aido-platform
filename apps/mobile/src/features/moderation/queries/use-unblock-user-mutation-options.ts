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

export function useUnblockUserMutationOptions() {
  const moderationService = useModerationService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const { success, error } = useAppToast();

  return mutationOptions({
    mutationFn: async ({ userId }: BlockTarget) =>
      unwrap(await moderationService.unblockUser(userId)),
    onSuccess: () => {
      notifySuccess();
      trackEvent('user_unblocked');
      success(t('moderation:unblock.toast'));
      return invalidateAfterBlockChange(queryClient);
    },
    onError: (unblockError) => {
      notifyError();
      if (isApiError(unblockError)) {
        error(unblockError.message);
      }
    },
    throwOnError: (unblockError) => !isApiError(unblockError),
  });
}
