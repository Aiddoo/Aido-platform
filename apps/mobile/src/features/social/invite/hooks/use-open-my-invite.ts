import type { InviteEntrySource } from '@src/features/social/invite/schemas/invite-entry.schema';
import { useTrack } from '@src/shared/analytics';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { type Href, router } from 'expo-router';
import { useCallback } from 'react';

/** 진입점에서 내 초대 화면을 연다. 누른 곳은 invite_entry_tapped.entry로 남긴다(화면 조회는 전역 screen_view가 맡는다) */
export function useOpenMyInvite() {
  const { trackEvent } = useTrack();
  const push = useSingleTap(router.push);

  return useCallback(
    (entry: InviteEntrySource, navigate: (href: Href) => void = push) => {
      trackEvent('invite_entry_tapped', { entry });
      navigate('/friends/invite');
    },
    [push, trackEvent],
  );
}
