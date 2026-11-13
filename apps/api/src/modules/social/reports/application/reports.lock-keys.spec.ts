import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { UserReportLockKeys } from "./reports.lock-keys.js";

// 배포가 겹치는 동안 이전 버전과 같은 잠금을 잡아야 해서 문자열을 바이트 단위로 고정한다
describe("UserReportLockKeys", () => {
  it("신고한 사람 잠금 키는 옮기기 전 문자열과 같다", () => {
    // When
    const key = UserReportLockKeys.reporter(UserId.reconstitute("sender"));

    // Then
    expect(key).toBe("mutation:v1:user-report:sender");
  });
});
