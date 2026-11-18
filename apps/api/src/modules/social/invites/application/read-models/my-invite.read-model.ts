import type { InviterProgressReadModel } from "#api/modules/social/invite-redemptions/social-invite-redemptions.public";

// 내 초대 화면에 필요한 코드·인원·보상 요약
export interface MyInviteReadModel extends InviterProgressReadModel {
  readonly code: string;
  readonly createdAt: Temporal.Instant;
}
