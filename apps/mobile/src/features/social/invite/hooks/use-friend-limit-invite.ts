import { INVITE_QUALIFICATION } from '@aido/api/vocabulary';
import type { FriendLimitInvite } from '@src/features/social/friend/domains/friend.model';
import { useTranslation } from '@src/shared/i18n';

import { useInviteAvailability } from './use-invite-availability';
import { useOpenMyInvite } from './use-open-my-invite';

/** 친구 한도 안내에서 초대로 자리를 늘리는 길. 초대를 쓸 수 없으면 undefined다 */
export function useFriendLimitInvite(): FriendLimitInvite | undefined {
  const { t } = useTranslation('invite');
  const isInviteAvailable = useInviteAvailability();
  const openMyInvite = useOpenMyInvite();

  if (!isInviteAvailable) {
    return undefined;
  }

  return {
    getDescription: (limit) =>
      t('entry.friendLimitDescription', {
        limit,
        activeDays: INVITE_QUALIFICATION.MIN_ACTIVE_DAYS,
      }),
    actionLabel: t('entry.growFriendLimit'),
    open: () => openMyInvite('friend_limit_dialog'),
  };
}
