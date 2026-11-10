import { ErrorCode } from "@aido/api/errors";

import { UserId } from "./user-id.vo.js";

describe("UserId — 사용자 식별자", () => {
  it("빈 문자열이면 SYS_0002로 거절한다", () => {
    // Given
    const raw = "";

    // When
    const create = () => UserId.create(raw);

    // Then
    expect(create).toThrow(
      expect.objectContaining({ errorCode: ErrorCode.SYS_0002, details: { field: "userId" } }),
    );
  });

  it("저장된 값은 검증 없이 복원하고 같은 값의 id와 같다", () => {
    // Given
    const created = UserId.create("cuid_user_1");

    // When
    const restored = UserId.reconstitute("cuid_user_1");

    // Then
    expect(restored.equals(created)).toBe(true);
  });
});
