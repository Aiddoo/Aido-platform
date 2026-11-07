import type { InviteFriendship, RedeemOutcome } from '@aido/api/vocabulary';
import type { InviteEntrySource } from '@src/shared/observability/telemetry-keys';

import type { RedeemFailureReason } from '../domains/invite.error';
import type { InviteLinkSource } from '../schemas/invite-redemption.schema';
import type { InviteShareChannel } from '../schemas/invite-share.schema';

declare module '@src/shared/analytics/event-map' {
  /**
   * 친구 초대 퍼널. 사용자 id·초대 코드는 넣지 않는다.
   * 사용 시작과 보상 지급은 서버 로그가 원천이다.
   */
  interface AppEventMap {
    invite_link_shared: { channel: InviteShareChannel };
    invite_entry_tapped: { entry: InviteEntrySource };
    invite_link_opened: { source: InviteLinkSource };
    invite_redeemed: { outcome: RedeemOutcome; friendship: InviteFriendship | 'NONE' };
    invite_redeem_failed: { reason: RedeemFailureReason };
  }
}

export {};
