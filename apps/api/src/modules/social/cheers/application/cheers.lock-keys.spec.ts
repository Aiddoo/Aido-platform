import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { CheerLockKeys } from "./cheers.lock-keys.js";

const SENDER = UserId.reconstitute("sender");
const RECEIVER = UserId.reconstitute("receiver");

// 배포가 겹치는 동안 이전 버전과 같은 잠금을 잡아야 해서 문자열을 바이트 단위로 고정한다
describe("CheerLockKeys", () => {
  it("하루 한도·같은 친구 쿨다운 잠금 키는 옮기기 전 문자열과 같다", () => {
    // When
    const keys = [CheerLockKeys.dailyQuota(SENDER), CheerLockKeys.cooldown(SENDER, RECEIVER)];

    // Then
    expect(keys).toEqual([
      "mutation:v1:cheer:daily-quota:sender",
      "mutation:v1:cheer:cooldown:sender:receiver",
    ]);
  });
});
