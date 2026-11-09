import { useRouteFriendQuery } from '@src/features/social/friend/hooks/use-route-friend-query';
import { useTranslation } from '@src/shared/i18n';

import { RemindNudgeButton } from './remind-nudge-button';

/** 오늘 할 일이 없는 친구에게 보내는 독촉 콕 버튼 */
export function FriendRemindNudgeAction() {
  const { t } = useTranslation('friend');
  const { data: friend } = useRouteFriendQuery();

  if (friend == null) {
    return null;
  }

  return (
    <RemindNudgeButton receiver={{ ...friend, displayName: friend.name ?? t('fallbackName') }} />
  );
}
