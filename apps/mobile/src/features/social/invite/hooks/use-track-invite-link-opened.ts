import { useTrack } from '@src/shared/analytics';
import { useEffect } from 'react';

import { useInviteParams } from './use-invite-params';

// 같은 링크 열림(source + openedAt)으로 화면이 다시 마운트돼도 한 번만 남긴다
// 앱이 떠 있는 동안 쌓이지 않게 최근 열림만 기억한다(Set은 삽입 순서를 지킨다)
const MAX_TRACKED_OPEN_KEYS = 20;
const trackedOpenKeys = new Set<string>();

function rememberOpenKey(openKey: string) {
  trackedOpenKeys.add(openKey);
  for (const oldestKey of trackedOpenKeys) {
    if (trackedOpenKeys.size <= MAX_TRACKED_OPEN_KEYS) {
      return;
    }
    trackedOpenKeys.delete(oldestKey);
  }
}

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

    rememberOpenKey(openKey);
    trackEvent('invite_link_opened', { source });
  }, [openedAt, source, trackEvent]);
}
