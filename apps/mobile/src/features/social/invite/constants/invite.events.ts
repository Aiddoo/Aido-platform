import type { InviteFriendship, RedeemOutcome } from '@aido/api/vocabulary';

import type { RedeemFailureReason } from '../domains/invite.error';
import type { InviteLinkSource } from '../domains/pending-redemption.model';
import type { InviteShareChannel } from '../services/invite-share.service';

/** 친구 초대로 들어온 곳. 누른 순간 invite_entry_tapped로 남긴다 */
export type InviteEntrySource =
  | 'friends_empty'
  | 'friend_strip_empty'
  | 'friend_limit_dialog'
  | 'mypage_card'
  | 'activation_checklist'
  | 'all_done_banner';

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
