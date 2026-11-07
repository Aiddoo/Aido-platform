import { useTrack } from '@src/shared/analytics';
import { useEffect } from 'react';

import { useInviteParams } from './use-invite-params';

// 같은 링크 열림(source + openedAt)으로 화면이 다시 마운트돼도 한 번만 남긴다
const trackedOpenKeys = new Set<string>();

/** 시스템이 연 초대 링크가 착지한 화면에서 invite_link_opened를 남긴다 */
export function useTrackInviteLinkOpened() {
  const [{ source, openedAt }] = useInviteParams();
  const { trackEvent } = useTrack();

  useEffect(() => {
    if (openedAt == null) {
      return;
    }

    const openKey = `${source}:${openedAt}`;
    if (trackedOpenKeys.has(openKey)) {
      return;
    }

    trackedOpenKeys.add(openKey);
    trackEvent('invite_link_opened', { source });
  }, [openedAt, source, trackEvent]);
}
