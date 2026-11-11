import { useTranslation } from '@src/shared/i18n';

import { INVITEE_PREMIUM_DAYS } from '../constants/invite.constants';
import type { Invite } from '../domains/invite.model';
import type { InviteShareContent } from '../services/invite-share.service';

/** 내 초대와 보내는 사람 이름으로 사용자 언어의 공유 문구를 만드는 함수를 돌려준다 */
export function useCreateInviteShareContent() {
  const { t } = useTranslation('invite');
  const days = INVITEE_PREMIUM_DAYS;

  return (myInvite: Invite, inviterName: string): InviteShareContent => ({
    inviteCode: myInvite.code,
    link: myInvite.link,
    copy: {
      kakaoTitle: t('share.kakaoTitle', { name: inviterName }),
      kakaoDescription: t('share.kakaoDescription', { days }),
      kakaoButton: t('share.kakaoButton'),
      message: t('share.message', { count: days }),
      dialogTitle: t('share.dialogTitle'),
    },
  });
}
