import { t } from '@src/shared/i18n';

import { InviteRewardPolicy } from '../domains/invite-reward.model';
import type { InviteShareCopy } from '../domains/invite-share.model';

export function getInviteShareCopy(inviterName: string): InviteShareCopy {
  const days = InviteRewardPolicy.getWelcomePremiumDays();

  return {
    kakaoTitle: t('invite:share.kakaoTitle', { name: inviterName }),
    kakaoDescription: t('invite:share.kakaoDescription', { days }),
    kakaoButton: t('invite:share.kakaoButton'),
    message: t('invite:share.message', { count: days }),
    dialogTitle: t('invite:share.dialogTitle'),
  };
}
