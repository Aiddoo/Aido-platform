import { InviteCode } from "../../value-objects/invites/invite-code.vo.js";
import { Invite } from "./invite.aggregate.js";

describe("Invite", () => {
  it("발급 계획은 정규화된 코드로 ACTIVE 초대를 만든다", () => {
    // Given
    const issuedAt = new Date("2026-11-01T09:00:00.000Z");

    // When
    const plan = Invite.planIssue({
      inviterId: "cinviter00000000000000001",
      code: InviteCode.of("k7m2-qx"),
      issuedAt,
    });

    // Then
    expect(plan).toEqual({
      inviterId: "cinviter00000000000000001",
      code: "K7M2QX",
      status: "ACTIVE",
      createdAt: issuedAt,
    });
  });

  it("폐기는 한 번만 적용되고 다시 폐기하면 false를 반환한다", () => {
    // Given
    const invite = Invite.reconstitute({
      id: "cinvite000000000000000001",
      inviterId: "cinviter00000000000000001",
      code: "K7M2QX",
      status: "ACTIVE",
      createdAt: new Date("2026-11-01T09:00:00.000Z"),
      revokedAt: null,
    });
    const revokedAt = new Date("2026-11-02T09:00:00.000Z");

    // When
    const results = [invite.revoke(revokedAt), invite.revoke(new Date("2026-11-03T09:00:00.000Z"))];

    // Then
    expect(results).toEqual([true, false]);
    expect(invite.isActive()).toBe(false);
    expect(invite.revokedAt).toEqual(revokedAt);
  });
});
