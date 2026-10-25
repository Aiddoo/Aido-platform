import { INVITE_REDEEM_WINDOW_DAYS } from '@aido/api';
import { z } from 'zod';

import { InviteCodeSchema } from './invite.model';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/** 초대 코드가 앱에 들어온 경로. 분석 이벤트 invite_link_opened.source와 같은 값이다 */
export const InviteLinkSourceSchema = z.enum([
  'universal_link',
  'app_scheme',
  'kakao',
  'install_referrer',
  'code_entry',
]);

export type InviteLinkSource = z.output<typeof InviteLinkSourceSchema>;

export const PendingRedemptionSchema = z.strictObject({
  inviteCode: InviteCodeSchema,
  source: InviteLinkSourceSchema,
  savedAt: z.coerce.date(),
  ownerId: z.string().nullable(),
});

export type PendingRedemption = z.output<typeof PendingRedemptionSchema>;

export function isWithinDays(from: Date, now: Date, days: number) {
  return now.getTime() - from.getTime() < days * DAY_IN_MS;
}

export const InviteRedemptionPolicy = {
  isFresh(pending: PendingRedemption, now: Date) {
    return isWithinDays(pending.savedAt, now, INVITE_REDEEM_WINDOW_DAYS);
  },

  // 다른 계정으로 로그인한 경우 남의 초대를 대신 수락하지 않는다
  belongsTo(pending: PendingRedemption, userId: string) {
    return pending.ownerId == null || pending.ownerId === userId;
  },
};
