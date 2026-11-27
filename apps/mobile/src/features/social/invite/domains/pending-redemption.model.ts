import { type Instant, instantSchema } from '@src/shared/date/instant';
import { isWithinInviteRedeemWindow } from '@src/shared/domains/invite-redeem-window.model';
import { z } from 'zod';

import { inviteCodeSchema } from './invite-code.model';

// 분석 이벤트 invite_link_opened.source와 같은 값이다
export const inviteLinkSourceSchema = z.enum([
  'universal_link',
  'app_scheme',
  'kakao',
  'install_referrer',
  'code_entry',
]);
export type InviteLinkSource = z.infer<typeof inviteLinkSourceSchema>;

export const pendingRedemptionSchema = z.strictObject({
  inviteCode: inviteCodeSchema,
  source: inviteLinkSourceSchema,
  savedAt: instantSchema,
});
export type PendingRedemption = z.infer<typeof pendingRedemptionSchema>;

export const PendingRedemptionPolicy = {
  isFresh(pending: PendingRedemption, now: Instant): boolean {
    return isWithinInviteRedeemWindow(pending.savedAt, now);
  },
};
