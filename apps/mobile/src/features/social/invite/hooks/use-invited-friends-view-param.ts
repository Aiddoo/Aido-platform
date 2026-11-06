import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useCallback } from 'react';

import {
  invitedFriendsParamsSchema,
  type InvitedFriendsView,
} from '../schemas/invite-params.schema';

/** 초대한 친구 목록 보기(?view=all|waiting) */
export function useInvitedFriendsViewParam() {
  const [{ view }, setParams] = useRouteParams(invitedFriendsParamsSchema);
  const setView = useCallback((next: InvitedFriendsView) => setParams({ view: next }), [setParams]);

  return [view, setView] as const;
}
