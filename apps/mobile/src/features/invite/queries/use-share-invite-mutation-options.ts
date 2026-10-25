import { useInviteShareService } from '@src/bootstrap/providers/di-context';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { notifyError, notifySuccess } from '@src/shared/utils/haptics';
import { mutationOptions } from '@tanstack/react-query';

import type { InviteShareChannel, InviteShareContent } from '../domains/invite-share.model';

interface ShareInviteVariables {
  channel: InviteShareChannel;
  content: InviteShareContent;
}

export function useShareInviteMutationOptions() {
  const inviteShareService = useInviteShareService();
  const { success, error } = useAppToast();

  return mutationOptions({
    mutationFn: ({ channel, content }: ShareInviteVariables) =>
      inviteShareService.share(channel, content),
    onSuccess: ({ outcome }) => {
      if (outcome === 'copied') {
        notifySuccess();
        success(t('invite:toast.linkCopied'));
      }
    },
    // 복사까지 실패하면 다시 시도하게만 알린다(공유는 화면 상태를 바꾸지 않는다)
    onError: () => {
      notifyError();
      error(t('invite:toast.shareFailed'));
    },
  });
}
