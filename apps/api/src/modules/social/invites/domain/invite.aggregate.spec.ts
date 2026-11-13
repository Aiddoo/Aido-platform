import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  createInviteFixture,
  INVITE_FIXTURE_INVITER_ID,
  INVITE_FIXTURE_NOW,
} from "#test/fixtures/social/invite.fixture";

import { InviteCode } from "../../shared/domain/invite-code.vo.js";
import { InviteId } from "../../shared/domain/invite-id.vo.js";
import { Invite } from "./invite.aggregate.js";

describe("Invite — 초대", () => {
  it("발급하면 정규화된 코드로 폐기 시각 없는 ACTIVE 초대가 된다", () => {
    // Given
    const params = {
      id: InviteId.reconstitute("cinvite000000000000000001"),
      inviterId: UserId.reconstitute(INVITE_FIXTURE_INVITER_ID),
      code: InviteCode.create("k7m2-qx"),
      now: INVITE_FIXTURE_NOW,
    };

    // When
    const invite = Invite.create(params);

    // Then
    expect(invite.toPrimitives()).toEqual({
      id: "cinvite000000000000000001",
      inviterId: INVITE_FIXTURE_INVITER_ID,
      code: "K7M2QX",
      status: "ACTIVE",
      createdAt: INVITE_FIXTURE_NOW,
      revokedAt: null,
    });
  });

  it("폐기는 한 번만 적용되고 다시 폐기하면 false를 반환한다", () => {
    // Given
    const invite = createInviteFixture();
    const revokedAt = INVITE_FIXTURE_NOW.add({ hours: 24 });

    // When
    const results = [invite.revoke(revokedAt), invite.revoke(revokedAt.add({ hours: 24 }))];

    // Then
    expect(results).toEqual([true, false]);
    expect(invite.isActive()).toBe(false);
    expect(invite.revokedAt).toEqual(revokedAt);
  });
});
