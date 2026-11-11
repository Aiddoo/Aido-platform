import {
  InviteRedemption,
  type InviteRedemptionPrimitives,
} from "#api/modules/social/invites/domain/invite-redemption.aggregate";

import {
  INVITE_FIXTURE_ID,
  INVITE_FIXTURE_INVITEE_ID,
  INVITE_FIXTURE_INVITER_ID,
  INVITE_FIXTURE_NOW,
} from "./invite.fixture.js";

export const INVITE_REDEMPTION_FIXTURE_ID = "c0000000000000000000rdm01";
const INVITE_REDEMPTION_FIXTURE_JOINED_AT = INVITE_FIXTURE_NOW;
// 수락 14일 뒤
const INVITE_REDEMPTION_FIXTURE_EXPIRES_AT = Temporal.Instant.from("2028-03-13T03:00:00Z");

export function activeDaysOf(...dateKeys: readonly string[]): Temporal.PlainDate[] {
  return dateKeys.map((dateKey) => Temporal.PlainDate.from(dateKey));
}

export function createInviteRedemptionFixture(
  overrides: Partial<InviteRedemptionPrimitives> = {},
): InviteRedemption {
  return InviteRedemption.reconstitute({
    id: INVITE_REDEMPTION_FIXTURE_ID,
    inviteId: INVITE_FIXTURE_ID,
    inviterId: INVITE_FIXTURE_INVITER_ID,
    inviteeId: INVITE_FIXTURE_INVITEE_ID,
    status: "JOINED",
    rejectionReason: null,
    timezone: "Asia/Seoul",
    inviterRewardEligible: true,
    activeDays: [],
    joinedAt: INVITE_REDEMPTION_FIXTURE_JOINED_AT,
    qualifiedAt: null,
    rewardedAt: null,
    rejectedAt: null,
    expiresAt: INVITE_REDEMPTION_FIXTURE_EXPIRES_AT,
    qualifyReminderSentAt: null,
    ...overrides,
  });
}
