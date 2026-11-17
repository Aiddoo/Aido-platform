import { ErrorCode } from "@aido/api/errors";

import { FriendshipStatus } from "./friendship-status.vo.js";

describe("FriendshipStatus", () => {
  it.each([
    { raw: "PENDING", isPending: true, isAccepted: false },
    { raw: "ACCEPTED", isPending: false, isAccepted: true },
  ])("$raw 상태를 만들고 대기·수락을 판별한다", ({ raw, isPending, isAccepted }) => {
    // When
    const status = FriendshipStatus.create(raw);

    // Then
    expect(status.value).toBe(raw);
    expect(status.isPending()).toBe(isPending);
    expect(status.isAccepted()).toBe(isAccepted);
  });

  it("알 수 없는 상태는 SYS_0001로 거절한다", () => {
    // When
    const creation = () => FriendshipStatus.create("BLOCKED");

    // Then
    expect(creation).toThrow(
      expect.objectContaining({
        errorCode: ErrorCode.SYS_0001,
        details: { detail: "Unknown friendship status", value: "BLOCKED" },
      }),
    );
  });
});
