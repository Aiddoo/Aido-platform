import { useFriendService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { notifyError } from '@src/shared/utils/haptics';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { invalidateFriends } from './friend-cache';

export const useAcceptRequestMutationOptions = () => {
  const friendService = useFriendService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (userId: string) => {
      const result = await friendService.acceptRequest(userId);
      return unwrap(result);
    },
    onSuccess: async () => {
      await invalidateFriends(queryClient);
      toast.success(t('friend:toast.requestAccepted'));
      trackEvent('friend_request_accepted');
    },
    onError: () => {
      notifyError();
    },
  });
};
