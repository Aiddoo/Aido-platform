import { useHaptics, useInviteShareService } from '@src/bootstrap/providers/di-context';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { useTrack } from '@src/shared/analytics';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import type { InviteShareChannel, InviteShareContent } from '../domains/invite-share.model';

interface ShareInviteVariables {
  channel: InviteShareChannel;
  content: InviteShareContent;
}

export function useShareInviteMutationOptions() {
  const haptics = useHaptics();
  const inviteShareService = useInviteShareService();
  const { success, error } = useAppToast();
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();
  const queryClient = useQueryClient();

  return mutationOptions({
    // 기기 안에서만 처리해 연결 상태와 무관하다
    networkMode: 'always',
    mutationFn: ({ channel, content }: ShareInviteVariables) =>
      inviteShareService.share(channel, content),
    onSuccess: ({ channel, outcome }) => {
      if (outcome !== 'dismissed') {
        trackEvent('invite_link_shared', { channel });
        const accountId = getCachedMe(queryClient)?.id;
        if (accountId != null) {
          trackAttributedFeatureSuccess({ accountId, feature: 'friend_invite' });
        }
      }

      if (outcome === 'copied') {
        haptics.notify('success');
        success(t('invite:toast.linkCopied'));
      }
    },
    // 복사까지 실패하면 다시 시도하게만 알린다(공유는 화면 상태를 바꾸지 않는다)
    onError: () => {
      haptics.notify('error');
      error(t('invite:toast.shareFailed'));
    },
  });
}
