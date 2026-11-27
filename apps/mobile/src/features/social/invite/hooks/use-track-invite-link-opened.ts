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
    // oxlint-disable-next-line aido/no-tracking-in-effect -- 마운트를 넘어 링크마다 한 번이라 프로세스 수명 store가 막는다
    trackEvent('invite_link_opened', { source });
  }, [inviteLinkOpenedStore, openedAt, source, trackEvent]);
}

/** 시스템 링크로 이 화면에 왔으면 착지할 때 이미 한 번 세어 앱 안에서 연 코드 입력만 센다 */
export function useTrackInviteCodeEntryOpened() {
  const [{ openedAt }] = useInviteParams();
  const { trackEvent } = useTrack();

  return () => {
    if (openedAt == null) {
      trackEvent('invite_link_opened', { source: 'code_entry' });
    }
  };
}
