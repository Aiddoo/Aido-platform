import { useInviteLinkOpenedStore } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { useEffect } from 'react';

import { useInviteParams } from './use-invite-params';

/** 시스템이 연 초대 링크가 착지한 화면에서 invite_link_opened를 남긴다 */
export function useTrackInviteLinkOpened() {
  const [{ source, openedAt }] = useInviteParams();
  const { trackEvent } = useTrack();
  const inviteLinkOpenedStore = useInviteLinkOpenedStore();

  useEffect(() => {
    if (openedAt == null || !inviteLinkOpenedStore.markOpened(`${source}:${openedAt}`)) {
      return;
    }
    trackEvent('invite_link_opened', { source });
  }, [inviteLinkOpenedStore, openedAt, source, trackEvent]);
}
