import { PUSH_FAILURE_KIND, revokesPushToken } from "./push-failure-kind.constants.js";

describe("PushFailureKind — 발송 실패 분류", () => {
  it("등록이 끊겼거나 형식이 틀린 토큰만 비활성화 대상이다", () => {
    // When
    const revokingKinds = Object.values(PUSH_FAILURE_KIND).filter((kind) => revokesPushToken(kind));

    // Then
    // 일시 실패·payload 문제로 멀쩡한 기기 토큰을 끄지 않는다
    expect(revokingKinds).toEqual([
      PUSH_FAILURE_KIND.DEVICE_UNREGISTERED,
      PUSH_FAILURE_KIND.INVALID_TOKEN,
    ]);
  });
});
