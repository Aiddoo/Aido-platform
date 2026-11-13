import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { NudgeLockKeys } from "./nudges.lock-keys.js";

const SENDER = UserId.reconstitute("sender");

// 배포가 겹치는 동안 이전 버전과 같은 잠금을 잡아야 해서 문자열을 바이트 단위로 고정한다
describe("NudgeLockKeys", () => {
  it("콕 일간 한도·할 일 쿨다운 잠금 키는 옮기기 전 문자열과 같다", () => {
    // When
    const keys = [NudgeLockKeys.dailyQuota(SENDER), NudgeLockKeys.cooldown(SENDER, 42)];

    // Then
    expect(keys).toEqual([
      "mutation:v1:nudge:daily-quota:sender",
      "mutation:v1:nudge:cooldown:sender:42",
    ]);
  });
});
