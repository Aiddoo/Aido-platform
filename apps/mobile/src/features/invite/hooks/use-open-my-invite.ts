import { useTrack } from '@src/shared/analytics';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import type { InviteEntrySource } from '@src/shared/observability/telemetry-keys';
import { router } from 'expo-router';
import { useCallback } from 'react';

import { myInviteHref } from '../utils/navigation/invite-href';

/** 진입점에서 내 초대 화면을 연다. 누른 곳은 invite_entry_tapped.entry로 남긴다(화면 조회는 전역 screen_view가 맡는다) */
export function useOpenMyInvite() {
  const { trackEvent } = useTrack();
  const push = useSingleTap(router.push);

  return useCallback(
    (entry: InviteEntrySource) => {
      trackEvent('invite_entry_tapped', { entry });
      push(myInviteHref());
    },
    [push, trackEvent],
  );
}
