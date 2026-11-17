import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { FriendshipLockKeys } from "./friendships.lock-keys.js";

const ALICE = UserId.reconstitute("user-a");
const BOB = UserId.reconstitute("user-b");

describe("FriendshipLockKeys", () => {
  it("두 사람 순서와 상관없이 같은 쌍 잠금 키를 옮기기 전 문자열 그대로 만든다", () => {
    // When
    const keys = [FriendshipLockKeys.pair(ALICE, BOB), FriendshipLockKeys.pair(BOB, ALICE)];

    // Then
    expect(keys).toEqual([
      "mutation:v1:friend:pair:user-a:user-b",
      "mutation:v1:friend:pair:user-a:user-b",
    ]);
  });

  it("친구 목록 잠금 키를 옮기기 전 문자열 그대로 만든다", () => {
    // When
    const key = FriendshipLockKeys.list(ALICE);

    // Then
    expect(key).toBe("mutation:v1:friend:list:user-a");
  });
});
