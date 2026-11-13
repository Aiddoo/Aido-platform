import { INVITE_REDEEM_WINDOW_DAYS } from '@aido/api/vocabulary';
import { DAY_MS } from '@src/shared/constants/time-units';
import { diffMs, type Instant, instantSchema } from '@src/shared/date/instant';
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

function isFresh(pending: PendingRedemption, now: Instant) {
  return diffMs(now, pending.savedAt) < INVITE_REDEEM_WINDOW_DAYS * DAY_MS;
}

/** 기기에 저장해 둔 수락 대기 초대 */
export const PendingRedemptionPolicy = {
  isFresh,
} as const;
