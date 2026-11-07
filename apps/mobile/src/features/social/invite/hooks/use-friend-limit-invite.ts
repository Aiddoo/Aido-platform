import { useIsInviteAvailable } from './use-is-invite-available';
import { useOpenMyInvite } from './use-open-my-invite';

/** 친구 한도 안내에서 초대로 자리를 늘리는 길을 여는 함수. 초대를 쓸 수 없으면 undefined다 */
export function useFriendLimitInvite(): (() => void) | undefined {
  const isInviteAvailable = useIsInviteAvailable();
  const openMyInvite = useOpenMyInvite();

  if (!isInviteAvailable) {
    return undefined;
  }

  return () => openMyInvite('friend_limit_dialog');
}
